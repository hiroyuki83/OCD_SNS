'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { put } from '@vercel/blob';
import { auth } from '@/auth';
import { AccountStatus, ReportPriority, ReportReason } from '@prisma/client';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { evaluatePostSafety, validatePublicPostContent } from '@/lib/contentSafety';
import { isEmailDeliveryConfigured } from '@/lib/email';
import { sendEmailVerification } from '@/lib/emailVerification';
import { MAX_IMAGE_SIZE_BYTES, validateImageUpload } from '@/lib/uploadSecurity';
import { isSuspensionActive } from '@/lib/accountStatus';
import { normalizeAutoHashtag, normalizeProfileBio, normalizeProfileName } from '@/lib/profileInput';
import { deleteManagedBlob, deleteManagedBlobs } from '@/lib/blobCleanup';
import { mutateFollowRelation } from '@/lib/userRelations';
import { parseBoundedInteger, parseBoundedStringList, parseItqTiming } from '@/lib/selfTestInput';
import { togglePostInteraction } from '@/lib/postInteractions';
import { mutateBlockRelation, mutateMuteRelation } from '@/lib/userPrivacyRelations';
import { getNormalizedAccountModerationState } from '@/lib/accountModeration';
import { isE2eBlobMode } from '@/lib/blobDeliveryMode';
import { normalizeImageAlt } from '@/lib/postImageAlt';
import { sanitizeImageMetadata } from '@/lib/imageSanitizationCore';
import { logOperationalError } from '@/lib/operationalError';

const RegisterSchema = z.object({
    name: z.string().trim().min(1, '名前は必須です').max(50, '名前は50文字以内です'),
    email: z.string().trim().toLowerCase().max(254, 'メールアドレスが長すぎます').email('正しいメールアドレスを入力してください'),
    password: z
        .string()
        .min(10, 'パスワードは10文字以上です')
        .max(128, 'パスワードは128文字以内です')
        .refine((value) => /\S/.test(value), 'パスワードに空白以外の文字を含めてください'),
});

export type RegisterState =
    | {
          errors: {
              name?: string[];
              email?: string[];
              password?: string[];
          };
          message: string;
          ok?: boolean;
      }
    | { message: string; ok?: boolean }
    | undefined;

export async function register(
    _prevState: RegisterState,
    formData: FormData,
): Promise<RegisterState> {
    const validatedFields = RegisterSchema.safeParse({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: '入力が不足しています。',
        };
    }

    const { name, email, password } = validatedFields.data;
    const normalizedName = normalizeProfileName(name);
    if (!normalizedName || Array.from(normalizedName).length > 50) {
        return {
            errors: { name: ['名前は1〜50文字で入力してください。'] },
            message: '入力内容を確認してください。',
        };
    }
    const normalizedEmail = email.toLowerCase();
    if (!(await rateLimit(`register:${normalizedEmail}`, 3, 60 * 60 * 1000))) {
        return { message: '登録試行が多すぎます。しばらくしてから再度お試しください。' };
    }
    if (!isEmailDeliveryConfigured()) {
        return { message: '現在、新規登録用メールを送信できません。管理者にお問い合わせください。' };
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    let createdUser: { id: string; email: string };
    try {
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
        if (existingUser) {
            return { message: 'このメールアドレスは既に使用されています。' };
        }

        createdUser = await prisma.user.create({
            data: {
                name: normalizedName,
                email: normalizedEmail,
                password: hashedPassword,
            },
            select: { id: true, email: true },
        });
    } catch {
        return { message: '登録に失敗しました。時間をおいて再度お試しください。' };
    }

    try {
        await sendEmailVerification(createdUser);
    } catch (error) {
        logOperationalError('REGISTRATION_VERIFICATION_EMAIL_FAILED', error);
        return {
            message: 'アカウントは作成されましたが、確認メールを送信できませんでした。確認メールの再送をお試しください。',
        };
    }

    return { ok: true, message: '確認メールを送信しました。メール内のリンクから登録を完了してください。' };
}

const AuthenticateSchema = z
    .object({
        email: z.string().trim().toLowerCase().max(254).email(),
        password: z.string().min(6).max(128),
        totpCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
        recoveryCode: z.string().trim().max(64).optional().or(z.literal('')),
    })
    .refine((data) => !(data.totpCode && data.recoveryCode), {
        path: ['recoveryCode'],
        message: '6桁コードとリカバリーコードはどちらか一方だけ入力してください。',
    });

export async function authenticate(
    _prevState: string | undefined,
    formData: FormData,
) {
    const parsed = AuthenticateSchema.safeParse({
        email: formData.get('email'),
        password: formData.get('password'),
        totpCode: formData.get('totpCode') ?? '',
        recoveryCode: formData.get('recoveryCode') ?? '',
    });
    if (!parsed.success) {
        return parsed.error.issues[0]?.message ?? '入力内容を確認してください。';
    }

    try {
        await signIn('credentials', {
            email: parsed.data.email,
            password: parsed.data.password,
            totpCode: parsed.data.totpCode,
            recoveryCode: parsed.data.recoveryCode,
            redirectTo: '/',
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'メールアドレス、パスワード、または必要な2段階認証を確認してください。';
                default:
                    return 'エラーが発生しました。';
            }
        }
        throw error;
    }
}

const CreatePostSchema = z.object({
    content: z.string().trim().max(1000, '本文は1000文字までです。').optional(),
});

export type CreatePostState =
    | {
          message: string;
          safety?: { requiresAcknowledgement: true };
      }
    | undefined;

async function uploadImage(file: File, pathPrefix: string) {
    const validation = await validateImageUpload(file);
    if (!validation.ok) {
        return { error: validation.error } as const;
    }

    try {
        const sanitized = await sanitizeImageMetadata(
            validation.bytes,
            validation.mime,
        );

        if (sanitized.data.byteLength > MAX_IMAGE_SIZE_BYTES) {
            return {
                error: '画像の再処理後サイズが5MBを超えました。別の画像をお試しください。',
            } as const;
        }

        if (isE2eBlobMode(process.env)) {
            const bytes = Buffer.from(sanitized.data);
            return {
                url: `data:${validation.mime};base64,${bytes.toString('base64')}`,
            } as const;
        }

        const uploadBytes = new Uint8Array(sanitized.data.byteLength);
        uploadBytes.set(sanitized.data);
        const body = new Blob([uploadBytes.buffer], {
            type: validation.mime,
        });
        const blob = await put(
            `${pathPrefix}/${validation.objectName}`,
            body,
            {
                access: 'public',
                contentType: validation.mime,
            },
        );
        return { url: blob.url } as const;
    } catch (error) {
        logOperationalError('IMAGE_UPLOAD_PROCESSING_FAILED', error);
        return { error: '画像のアップロードに失敗しました。' } as const;
    }
}

export async function createPost(
    _prevState: CreatePostState,
    formData: FormData,
): Promise<CreatePostState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) {
        return { message: 'ログインしてください。' };
    }
    const moderationState = await getNormalizedAccountModerationState(userId);
    if (!moderationState) {
        return { message: 'ユーザーが見つかりません。' };
    }
    if (moderationState.status === AccountStatus.SUSPENDED) {
        return {
            message:
                moderationState.restrictionReason ??
                'アカウントが停止中のため投稿できません。',
        };
    }
    if (moderationState.status === AccountStatus.POST_RESTRICTED) {
        const untilLabel = moderationState.restrictionUntil
            ? moderationState.restrictionUntil.toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
              })
            : null;
        const baseMessage =
            moderationState.restrictionReason ?? '投稿が制限されています。';
        return {
            message: untilLabel ? `${baseMessage}（${untilLabel}まで）` : baseMessage,
        };
    }
    if (!(await rateLimit(`create-post:${userId}`, 20, 60 * 1000))) {
        return { message: '投稿が多すぎます。少し待ってから再度お試しください。' };
    }

    const rawContent = formData.get('content');
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    const image = formData.get('image');
    const imageAltResult = normalizeImageAlt(formData.get('imageAlt'));
    if (!imageAltResult.ok) return { message: imageAltResult.error };
    const imageAlt = imageAltResult.value;

    let autoHashtag: string | null = null;
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { autoHashtag: true },
        });
        autoHashtag = user?.autoHashtag ?? null;
    }

    const normalizedHashtag = autoHashtag?.trim() ?? '';
    const finalContent = normalizedHashtag
        ? content
            ? `${content}\n${normalizedHashtag}`
            : normalizedHashtag
        : content;

    const contentResult = CreatePostSchema.safeParse({ content: finalContent });
    if (!contentResult.success) {
        return { message: contentResult.error.issues[0]?.message ?? '本文が不正です。' };
    }
    const safetyError = validatePublicPostContent(finalContent);
    if (safetyError) {
        return { message: safetyError };
    }

    const hasImage = image instanceof File && image.size > 0;
    if (!finalContent && !hasImage) {
        return { message: '本文か画像のどちらかは必要です。' };
    }

    const safetyAssessment = evaluatePostSafety(finalContent);
    const safetyAcknowledged = formData.get('safetyAcknowledged') === 'true';
    if (safetyAssessment.level === 'urgent' && !safetyAcknowledged) {
        return {
            message: '安全を確認するため、案内を読んでから投稿を続けてください。',
            safety: { requiresAcknowledgement: true },
        };
    }

    let imageUrl: string | null = null;
    if (hasImage) {
        const upload = await uploadImage(image, `posts/${userId}`);
        if ('error' in upload) return { message: upload.error ?? '画像のアップロードに失敗しました。' };
        imageUrl = upload.url;
    }

    try {
        const created = await prisma.$transaction(async (tx) => {
            const currentUser = await tx.user.findUnique({
                where: { id: userId },
                select: { status: true },
            });
            if (!currentUser || currentUser.status !== AccountStatus.ACTIVE) {
                return false;
            }

            const post = await tx.post.create({
                data: {
                    content: finalContent || '',
                    imageUrl,
                    imageAlt: imageUrl ? imageAlt : null,
                    authorId: userId,
                },
                select: { id: true },
            });

            if (safetyAssessment.level === 'urgent') {
                await tx.report.create({
                    data: {
                        reporterId: userId,
                        targetUserId: userId,
                        postId: post.id,
                        reason: ReportReason.SELF_HARM,
                        priority: ReportPriority.URGENT,
                        dueAt: new Date(Date.now() + 60 * 60 * 1000),
                        detail: '投稿時の自動検知により作成。安全案内を表示し、本人の確認後に投稿されました。',
                    },
                });
                await tx.auditLog.create({
                    data: {
                        action: 'SAFETY_FLAG_POST',
                        actorUserId: userId,
                        targetUserId: userId,
                        meta: { postId: post.id, level: safetyAssessment.level },
                    },
                });
            }
            return true;
        });

        if (!created) {
            if (imageUrl) await deleteManagedBlob(imageUrl);
            return { message: 'アカウント状態が変更されたため投稿できませんでした。画面を更新してください。' };
        }
    } catch (error) {
        if (imageUrl) {
            await deleteManagedBlob(imageUrl);
        }
        logOperationalError('POST_CREATE_FAILED', error);
        return { message: '投稿に失敗しました。' };
    }

    revalidatePath('/');
    if (safetyAssessment.level === 'urgent') {
        revalidatePath('/moderation');
        revalidatePath('/admin');
        revalidatePath('/admin/audit');
    }
    return { message: '投稿しました。' };
}


export async function toggleLike(postId: string) {
    postId = postId.trim();
    if (!postId || postId.length > 128) return;

    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) return;

    const result = await togglePostInteraction(userId, postId, 'like');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/post');
    revalidatePath(`/post/${postId}`);
    revalidatePath('/notifications');
}

export async function addWakaru(postId: string) {
    postId = postId.trim();
    if (!postId || postId.length > 128) return;

    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) return;

    const result = await togglePostInteraction(userId, postId, 'wakaru');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/post');
    revalidatePath(`/post/${postId}`);
    revalidatePath('/notifications');
}

export async function addGanbatta(postId: string) {
    postId = postId.trim();
    if (!postId || postId.length > 128) return;

    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) return;

    const result = await togglePostInteraction(userId, postId, 'ganbatta');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/post');
    revalidatePath(`/post/${postId}`);
    revalidatePath('/notifications');
}

export async function deletePost(postId: string) {
    postId = postId.trim();
    if (!postId || postId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`post-delete:${userId}`, 30, 60 * 1000))) return;

    const imageUrl = await prisma.$transaction(async (tx) => {
        const post = await tx.post.findFirst({
            where: {
                id: postId,
                authorId: userId,
                deletedAt: null,
            },
            select: { imageUrl: true },
        });
        if (!post) return null;

        const deletedAt = new Date();
        const deleted = await tx.post.updateMany({
            where: { id: postId, authorId: userId, deletedAt: null },
            data: {
                deletedAt,
                deletedById: userId,
            },
        });
        if (deleted.count !== 1) return null;

        await tx.notification.deleteMany({ where: { postId } });
        await tx.auditLog.create({
            data: {
                action: 'POST_DELETE_SELF',
                actorUserId: userId,
                targetUserId: userId,
                meta: {
                    postId,
                    imageBlobCleanupRequested: Boolean(post.imageUrl),
                },
            },
        });
        return post.imageUrl;
    });

    if (imageUrl) {
        await deleteManagedBlob(imageUrl);
    }

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/bookmarks');
    revalidatePath('/notifications');
    revalidatePath('/post');
    revalidatePath(`/post/${postId}`);
}

export async function followUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`follow-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateFollowRelation(userId, targetUserId, 'follow');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/following');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
}

export async function unfollowUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`follow-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateFollowRelation(userId, targetUserId, 'unfollow');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/following');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
}

export async function acceptFollowRequest(followerId: string) {
    followerId = followerId.trim();
    if (!followerId || followerId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === followerId) return;
    if (!(await rateLimit(`follow-review:${userId}`, 100, 60 * 60 * 1000))) return;

    await prisma.$transaction(async (tx) => {
        const follower = await tx.user.findUnique({
            where: { id: followerId },
            select: { status: true, suspendedUntil: true },
        });
        if (!follower || isSuspensionActive(follower.status, follower.suspendedUntil)) return;

        const blocked = await tx.block.findFirst({
            where: {
                OR: [
                    { blockerId: userId, blockedId: followerId },
                    { blockerId: followerId, blockedId: userId },
                ],
            },
            select: { id: true },
        });
        if (blocked) return;

        await tx.follow.updateMany({
            where: {
                followerId,
                followingId: userId,
                acceptedAt: null,
            },
            data: { acceptedAt: new Date() },
        });
    });

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/followers');
    revalidatePath('/profile/following');
    revalidatePath('/notifications');
}

export async function rejectFollowRequest(followerId: string) {
    followerId = followerId.trim();
    if (!followerId || followerId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === followerId) return;
    if (!(await rateLimit(`follow-review:${userId}`, 100, 60 * 60 * 1000))) return;

    await prisma.$transaction(async (tx) => {
        const removed = await tx.follow.deleteMany({
            where: {
                followerId,
                followingId: userId,
                acceptedAt: null,
            },
        });
        if (removed.count === 1) {
            await tx.notification.deleteMany({
                where: {
                    type: 'FOLLOW',
                    userId,
                    actorId: followerId,
                },
            });
        }
    });

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/followers');
    revalidatePath('/profile/following');
    revalidatePath('/notifications');
}

export async function removeFollower(followerId: string) {
    followerId = followerId.trim();
    if (!followerId || followerId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === followerId) return;
    if (!(await rateLimit(`follower-remove:${userId}`, 100, 60 * 60 * 1000))) return;

    await prisma.$transaction(async (tx) => {
        const removed = await tx.follow.deleteMany({
            where: {
                followerId,
                followingId: userId,
                acceptedAt: { not: null },
            },
        });
        if (removed.count === 1) {
            await tx.notification.deleteMany({
                where: {
                    type: 'FOLLOW',
                    userId,
                    actorId: followerId,
                },
            });
        }
    });

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
}

export async function blockUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`block-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateBlockRelation(userId, targetUserId, 'block');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/blocks');
    revalidatePath('/profile/following');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
}

export async function unblockUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`block-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateBlockRelation(userId, targetUserId, 'unblock');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/blocks');
}

export async function muteUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`mute-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateMuteRelation(userId, targetUserId, 'mute');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/mutes');
    revalidatePath('/notifications');
}

export async function unmuteUser(targetUserId: string) {
    targetUserId = targetUserId.trim();
    if (!targetUserId || targetUserId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || userId === targetUserId) return;
    if (!(await rateLimit(`mute-action:${userId}`, 60, 60 * 1000))) return;

    const result = await mutateMuteRelation(userId, targetUserId, 'unmute');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/mutes');
}

export type ProfileState =
    | {
          message: string;
      }
    | undefined;

const ProfileSchema = z.object({
    name: z.string().max(50, '名前は50文字以内です。').nullable(),
    bio: z.string().max(500, '自己紹介は500文字以内です。').nullable(),
    autoHashtag: z.string().max(100, '自動ハッシュタグは100文字以内です。').nullable(),
});

export async function updateProfile(
    _prevState: ProfileState,
    formData: FormData,
): Promise<ProfileState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return { message: 'ログインしてください。' };
    if (!(await rateLimit(`profile-update:${userId}`, 10, 10 * 60 * 1000))) {
        return { message: 'プロフィール更新が多すぎます。少し待ってから再度お試しください。' };
    }
    const moderationState = await getNormalizedAccountModerationState(userId);
    if (!moderationState) return { message: 'ユーザーが見つかりません。' };
    if (moderationState.status === AccountStatus.SUSPENDED) {
        return { message: 'アカウント停止中はプロフィールを変更できません。' };
    }

    const rawName = formData.get('name');
    const rawBio = formData.get('bio');
    const rawAutoHashtag = formData.get('autoHashtag');
    if (
        typeof rawName !== 'string' ||
        typeof rawBio !== 'string' ||
        typeof rawAutoHashtag !== 'string'
    ) {
        return { message: 'プロフィールの入力内容が不正です。' };
    }

    const normalizedAutoHashtag = normalizeAutoHashtag(rawAutoHashtag);
    if (!normalizedAutoHashtag.ok) {
        return { message: normalizedAutoHashtag.error };
    }

    const profile = ProfileSchema.safeParse({
        name: normalizeProfileName(rawName),
        bio: normalizeProfileBio(rawBio),
        autoHashtag: normalizedAutoHashtag.value,
    });
    if (!profile.success) {
        return { message: profile.error.issues[0]?.message ?? 'プロフィールの入力内容が不正です。' };
    }

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            handle: true,
            avatarUrl: true,
            headerUrl: true,
        },
    });
    if (!currentUser) return { message: 'ユーザーが見つかりません。' };

    const { name, bio, autoHashtag } = profile.data;
    const avatar = formData.get('avatar');
    const header = formData.get('header');

    let avatarUrl: string | undefined;
    let headerUrl: string | undefined;

    if (avatar instanceof File && avatar.size > 0) {
        const upload = await uploadImage(avatar, `profiles/${userId}/avatar`);
        if ('error' in upload) return { message: upload.error ?? '画像のアップロードに失敗しました。' };
        avatarUrl = upload.url;
    }

    if (header instanceof File && header.size > 0) {
        const upload = await uploadImage(header, `profiles/${userId}/header`);
        if ('error' in upload) {
            if (avatarUrl) await deleteManagedBlob(avatarUrl);
            return { message: upload.error ?? '画像のアップロードに失敗しました。' };
        }
        headerUrl = upload.url;
    }

    let updatedUser: { handle: string } | null = null;
    try {
        updatedUser = await prisma.$transaction(async (tx) => {
            const changed = await tx.user.updateMany({
                where: {
                    id: userId,
                    status: { not: AccountStatus.SUSPENDED },
                },
                data: {
                    name,
                    bio,
                    autoHashtag,
                    avatarUrl,
                    headerUrl,
                },
            });
            if (changed.count !== 1) return null;
            return tx.user.findUnique({
                where: { id: userId },
                select: { handle: true },
            });
        });

        if (!updatedUser) {
            await deleteManagedBlobs([avatarUrl, headerUrl]);
            return { message: 'アカウント状態が変更されたためプロフィールを更新できませんでした。' };
        }
    } catch (error) {
        await deleteManagedBlobs([avatarUrl, headerUrl]);
        logOperationalError('PROFILE_UPDATE_FAILED', error);
        return { message: 'プロフィールの更新に失敗しました。' };
    }

    const replacedUrls = [
        avatarUrl && currentUser.avatarUrl && currentUser.avatarUrl !== avatarUrl
            ? currentUser.avatarUrl
            : null,
        headerUrl && currentUser.headerUrl && currentUser.headerUrl !== headerUrl
            ? currentUser.headerUrl
            : null,
    ];
    await deleteManagedBlobs(replacedUrls);

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/settings');
    revalidatePath(`/user/${encodeURIComponent(updatedUser.handle)}`);
    return { message: 'プロフィールを更新しました。' };
}

export async function togglePrivateAccount() {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`privacy-toggle:${userId}`, 10, 60 * 60 * 1000))) return;

    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
            where: { id: userId },
            select: { isPrivate: true, handle: true },
        });
        if (!user) return null;

        const nextValue = !user.isPrivate;
        const changed = await tx.user.updateMany({
            where: {
                id: userId,
                isPrivate: user.isPrivate,
            },
            data: { isPrivate: nextValue },
        });
        if (changed.count !== 1) return null;

        let acceptedPendingCount = 0;
        if (!nextValue) {
            const accepted = await tx.follow.updateMany({
                where: {
                    followingId: userId,
                    acceptedAt: null,
                },
                data: { acceptedAt: new Date() },
            });
            acceptedPendingCount = accepted.count;
        }

        await tx.auditLog.create({
            data: {
                action: 'ACCOUNT_PRIVACY_CHANGE',
                actorUserId: userId,
                targetUserId: userId,
                meta: {
                    fromPrivate: user.isPrivate,
                    toPrivate: nextValue,
                    acceptedPendingCount,
                },
            },
        });

        return {
            handle: user.handle,
            isPrivate: nextValue,
        };
    });

    if (!result) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/following');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
    revalidatePath('/admin/audit');
    revalidatePath(`/user/${encodeURIComponent(result.handle)}`);
}

export async function toggleBookmark(postId: string) {
    postId = postId.trim();
    if (!postId || postId.length > 128) return;

    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) return;

    const result = await togglePostInteraction(userId, postId, 'bookmark');
    if (!result.ok) return;

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/post');
    revalidatePath(`/post/${postId}`);
    revalidatePath('/bookmarks');
}

export async function deleteSelfTestResult(
    testType: 'ybocs' | 'iesr' | 'itq' | 'lsas',
    resultId: string,
) {
    resultId = resultId.trim();
    if (!['ybocs', 'iesr', 'itq', 'lsas'].includes(testType) || !resultId || resultId.length > 128) return;
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) return;
    if (!(await rateLimit(`test-result-delete:${userId}`, 60, 60 * 60 * 1000))) return;

    if (testType === 'ybocs') {
        await prisma.ybocsResult.deleteMany({ where: { id: resultId, userId } });
    } else if (testType === 'iesr') {
        await prisma.iesrResult.deleteMany({ where: { id: resultId, userId } });
    } else if (testType === 'itq') {
        await prisma.itqResult.deleteMany({ where: { id: resultId, userId } });
    } else if (testType === 'lsas') {
        await prisma.lsasResult.deleteMany({ where: { id: resultId, userId } });
    }

    revalidatePath('/test');
}

export type YbocsState =
    | {
          message: string;
      }
    | undefined;

export async function submitYbocs(
    _prevState: YbocsState,
    formData: FormData,
): Promise<YbocsState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) {
        return { message: 'ログインしてください。' };
    }
    if (!(await rateLimit(`self-test-submit:ybocs:${userId}`, 30, 60 * 60 * 1000))) {
        return { message: '保存回数が多すぎます。しばらくしてから再度お試しください。' };
    }

    const parsedScores = Array.from({ length: 10 }, (_, i) => parseBoundedInteger(formData.get(`q${i + 1}`), 0, 5));
    if (parsedScores.some((score) => score === null || score < 0 || score > 5)) {
        return { message: 'すべての設問に0〜5で回答してください。' };
    }

    const scores = parsedScores as number[];
    const rawCgiI = formData.get('cgiI');
    const rawCgiS = formData.get('cgiS');
    const hasCgiI = typeof rawCgiI === 'string' && rawCgiI.trim() !== '';
    const hasCgiS = typeof rawCgiS === 'string' && rawCgiS.trim() !== '';
    const cgiI = hasCgiI ? parseBoundedInteger(rawCgiI, 1, 7) : null;
    const cgiS = hasCgiS ? parseBoundedInteger(rawCgiS, 1, 7) : null;
    if ((hasCgiI && cgiI === null) || (hasCgiS && cgiS === null)) {
        return { message: 'CGIは1〜7で回答してください。' };
    }
    const obsessionsScore = scores.slice(0, 5).reduce((sum, val) => sum + (val ?? 0), 0);
    const compulsionsScore = scores.slice(5).reduce((sum, val) => sum + (val ?? 0), 0);
    const totalScore = obsessionsScore + compulsionsScore;

    const symptomsCurrent = parseBoundedStringList(formData.getAll('symptom_current'), 200, 200);
    const symptomsPast = parseBoundedStringList(formData.getAll('symptom_past'), 200, 200);
    if (!symptomsCurrent || !symptomsPast) {
        return { message: '症状リストの入力内容が不正です。' };
    }

    try {
        await prisma.ybocsResult.create({
            data: {
                userId,
                obsessionsScore,
                compulsionsScore,
                totalScore,
                cgiI: cgiI ?? null,
                cgiS: cgiS ?? null,
                q1: scores[0] ?? 0,
                q2: scores[1] ?? 0,
                q3: scores[2] ?? 0,
                q4: scores[3] ?? 0,
                q5: scores[4] ?? 0,
                q6: scores[5] ?? 0,
                q7: scores[6] ?? 0,
                q8: scores[7] ?? 0,
                q9: scores[8] ?? 0,
                q10: scores[9] ?? 0,
                symptomsCurrent,
                symptomsPast,
            },
        });
    } catch (error) {
        logOperationalError('YBOCS_RESULT_SAVE_FAILED', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return { message: '結果を保存しました。' };
}

export type IesrState =
    | {
          message: string;
      }
    | undefined;

const IESR_INTRUSION = [1, 2, 3, 6, 9, 14, 16, 20];
const IESR_AVOIDANCE = [5, 7, 8, 11, 12, 13, 17, 22];
const IESR_HYPERAROUSAL = [4, 10, 15, 18, 19, 21];

function sumByIndices(values: number[], indices: number[]) {
    return indices.reduce((sum, item) => sum + (values[item - 1] ?? 0), 0);
}

export async function submitIesr(
    _prevState: IesrState,
    formData: FormData,
): Promise<IesrState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) {
        return { message: 'ログインしてください。' };
    }
    if (!(await rateLimit(`self-test-submit:iesr:${userId}`, 30, 60 * 60 * 1000))) {
        return { message: '保存回数が多すぎます。しばらくしてから再度お試しください。' };
    }

    const parsedScores = Array.from({ length: 22 }, (_, i) => parseBoundedInteger(formData.get(`q${i + 1}`), 0, 4));
    if (parsedScores.some((score) => score === null || score < 0 || score > 4)) {
        return { message: 'すべての設問に0〜4で回答してください。' };
    }

    const scores = parsedScores as number[];
    const intrusionScore = sumByIndices(scores, IESR_INTRUSION);
    const avoidanceScore = sumByIndices(scores, IESR_AVOIDANCE);
    const hyperarousalScore = sumByIndices(scores, IESR_HYPERAROUSAL);
    const totalScore = scores.reduce((sum, val) => sum + val, 0);

    try {
        await prisma.iesrResult.create({
            data: {
                userId,
                totalScore,
                intrusionScore,
                avoidanceScore,
                hyperarousalScore,
                q1: scores[0],
                q2: scores[1],
                q3: scores[2],
                q4: scores[3],
                q5: scores[4],
                q6: scores[5],
                q7: scores[6],
                q8: scores[7],
                q9: scores[8],
                q10: scores[9],
                q11: scores[10],
                q12: scores[11],
                q13: scores[12],
                q14: scores[13],
                q15: scores[14],
                q16: scores[15],
                q17: scores[16],
                q18: scores[17],
                q19: scores[18],
                q20: scores[19],
                q21: scores[20],
                q22: scores[21],
            },
        });
    } catch (error) {
        logOperationalError('IESR_RESULT_SAVE_FAILED', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return { message: '結果を保存しました。' };
}

export type ItqState =
    | {
          message: string;
      }
    | undefined;

const ITQ_THRESHOLD = 2;

export async function submitItq(
    _prevState: ItqState,
    formData: FormData,
): Promise<ItqState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) {
        return { message: 'ログインしてください。' };
    }
    if (!(await rateLimit(`self-test-submit:itq:${userId}`, 30, 60 * 60 * 1000))) {
        return { message: '保存回数が多すぎます。しばらくしてから再度お試しください。' };
    }

    const eventTiming = parseItqTiming(formData.get('eventTiming'));
    if (!eventTiming) {
        return { message: '経験の時期を選択してください。' };
    }

    const pScores = Array.from({ length: 9 }, (_, i) => parseBoundedInteger(formData.get(`p${i + 1}`), 0, 4));
    const cScores = Array.from({ length: 9 }, (_, i) => parseBoundedInteger(formData.get(`c${i + 1}`), 0, 4));

    if (
        pScores.some((score) => score === null || score < 0 || score > 4) ||
        cScores.some((score) => score === null || score < 0 || score > 4)
    ) {
        return { message: 'すべての設問に0〜4で回答してください。' };
    }

    const p = pScores as number[];
    const c = cScores as number[];

    const reScore = (p[0] ?? 0) + (p[1] ?? 0);
    const avScore = (p[2] ?? 0) + (p[3] ?? 0);
    const thScore = (p[4] ?? 0) + (p[5] ?? 0);
    const adScore = (c[0] ?? 0) + (c[1] ?? 0);
    const nscScore = (c[2] ?? 0) + (c[3] ?? 0);
    const drScore = (c[4] ?? 0) + (c[5] ?? 0);

    const reDx = (p[0] ?? 0) >= ITQ_THRESHOLD || (p[1] ?? 0) >= ITQ_THRESHOLD;
    const avDx = (p[2] ?? 0) >= ITQ_THRESHOLD || (p[3] ?? 0) >= ITQ_THRESHOLD;
    const thDx = (p[4] ?? 0) >= ITQ_THRESHOLD || (p[5] ?? 0) >= ITQ_THRESHOLD;
    const ptsdFunctional = (p[6] ?? 0) >= ITQ_THRESHOLD || (p[7] ?? 0) >= ITQ_THRESHOLD || (p[8] ?? 0) >= ITQ_THRESHOLD;
    const ptsdMet = reDx && avDx && thDx && ptsdFunctional;

    const adDx = (c[0] ?? 0) >= ITQ_THRESHOLD || (c[1] ?? 0) >= ITQ_THRESHOLD;
    const nscDx = (c[2] ?? 0) >= ITQ_THRESHOLD || (c[3] ?? 0) >= ITQ_THRESHOLD;
    const drDx = (c[4] ?? 0) >= ITQ_THRESHOLD || (c[5] ?? 0) >= ITQ_THRESHOLD;
    const dsoFunctional = (c[6] ?? 0) >= ITQ_THRESHOLD || (c[7] ?? 0) >= ITQ_THRESHOLD || (c[8] ?? 0) >= ITQ_THRESHOLD;
    const dsoMet = adDx && nscDx && drDx && dsoFunctional;

    const ptsdScore = p.slice(0, 6).reduce((sum, val) => sum + (val ?? 0), 0);
    const dsoScore = c.slice(0, 6).reduce((sum, val) => sum + (val ?? 0), 0);

    let resultLabel = '基準を満たしていません';
    if (ptsdMet && dsoMet) {
        resultLabel = 'CPTSD（複雑性PTSD）の可能性があります';
    } else if (ptsdMet) {
        resultLabel = 'PTSDの可能性があります';
    }

    try {
        await prisma.itqResult.create({
            data: {
                userId,
                eventDescription: null,
                eventTiming,
                ptsdScore,
                dsoScore,
                reScore,
                avScore,
                thScore,
                adScore,
                nscScore,
                drScore,
                ptsdFunctional,
                dsoFunctional,
                ptsdMet,
                dsoMet,
                resultLabel,
                p1: p[0],
                p2: p[1],
                p3: p[2],
                p4: p[3],
                p5: p[4],
                p6: p[5],
                p7: p[6],
                p8: p[7],
                p9: p[8],
                c1: c[0],
                c2: c[1],
                c3: c[2],
                c4: c[3],
                c5: c[4],
                c6: c[5],
                c7: c[6],
                c8: c[7],
                c9: c[8],
            },
        });
    } catch (error) {
        logOperationalError('ITQ_RESULT_SAVE_FAILED', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return { message: '結果を保存しました。' };
}

export type LsasState =
    | {
          message: string;
      }
    | undefined;

function getLsasLabel(totalScore: number) {
    if (totalScore <= 29) return '正常範囲';
    if (totalScore <= 49) return '境界域';
    if (totalScore <= 69) return '中程度のSAD';
    if (totalScore <= 89) return '更に症状が著しい';
    return '重度のSAD';
}

export async function submitLsas(
    _prevState: LsasState,
    formData: FormData,
): Promise<LsasState> {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId) {
        return { message: 'ログインしてください。' };
    }
    if (!(await rateLimit(`self-test-submit:lsas:${userId}`, 30, 60 * 60 * 1000))) {
        return { message: '保存回数が多すぎます。しばらくしてから再度お試しください。' };
    }

    const fearScores = Array.from({ length: 24 }, (_, i) => parseBoundedInteger(formData.get(`f${i + 1}`), 0, 3));
    const avoidScores = Array.from({ length: 24 }, (_, i) => parseBoundedInteger(formData.get(`a${i + 1}`), 0, 3));

    if (
        fearScores.some((score) => score === null || score < 0 || score > 3) ||
        avoidScores.some((score) => score === null || score < 0 || score > 3)
    ) {
        return { message: 'すべての設問に0〜3で回答してください。' };
    }

    const fear = fearScores as number[];
    const avoid = avoidScores as number[];
    const fearScore = fear.reduce((sum, val) => sum + (val ?? 0), 0);
    const avoidScore = avoid.reduce((sum, val) => sum + (val ?? 0), 0);
    const totalScore = fearScore + avoidScore;
    const resultLabel = getLsasLabel(totalScore);

    try {
        await prisma.lsasResult.create({
            data: {
                userId,
                totalScore,
                fearScore,
                avoidScore,
                resultLabel,
                f1: fear[0],
                a1: avoid[0],
                f2: fear[1],
                a2: avoid[1],
                f3: fear[2],
                a3: avoid[2],
                f4: fear[3],
                a4: avoid[3],
                f5: fear[4],
                a5: avoid[4],
                f6: fear[5],
                a6: avoid[5],
                f7: fear[6],
                a7: avoid[6],
                f8: fear[7],
                a8: avoid[7],
                f9: fear[8],
                a9: avoid[8],
                f10: fear[9],
                a10: avoid[9],
                f11: fear[10],
                a11: avoid[10],
                f12: fear[11],
                a12: avoid[11],
                f13: fear[12],
                a13: avoid[12],
                f14: fear[13],
                a14: avoid[13],
                f15: fear[14],
                a15: avoid[14],
                f16: fear[15],
                a16: avoid[15],
                f17: fear[16],
                a17: avoid[16],
                f18: fear[17],
                a18: avoid[17],
                f19: fear[18],
                a19: avoid[18],
                f20: fear[19],
                a20: avoid[19],
                f21: fear[20],
                a21: avoid[20],
                f22: fear[21],
                a22: avoid[21],
                f23: fear[22],
                a23: avoid[22],
                f24: fear[23],
                a24: avoid[23],
            },
        });
    } catch (error) {
        logOperationalError('LSAS_RESULT_SAVE_FAILED', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return { message: '結果を保存しました。' };
}
