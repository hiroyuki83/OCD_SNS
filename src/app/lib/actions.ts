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
import { getAccessiblePostForViewer, usersAreBlocked } from '@/lib/postAccess';
import { validateImageUpload } from '@/lib/uploadSecurity';
import { isSuspensionActive } from '@/lib/accountStatus';

const RegisterSchema = z.object({
    name: z.string().trim().min(1, '名前は必須です').max(50, '名前は50文字以内です'),
    email: z.string().trim().toLowerCase().max(254, 'メールアドレスが長すぎます').email('正しいメールアドレスを入力してください'),
    password: z.string().min(10, 'パスワードは10文字以上です').max(128, 'パスワードは128文字以内です'),
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
                name,
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
        console.error('Failed to send registration verification email:', error);
        return {
            message: 'アカウントは作成されましたが、確認メールを送信できませんでした。確認メールの再送をお試しください。',
        };
    }

    return { ok: true, message: '確認メールを送信しました。メール内のリンクから登録を完了してください。' };
}

const AuthenticateSchema = z.object({
    email: z.string().trim().toLowerCase().max(254).email(),
    password: z.string().min(1).max(128),
    totpCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
    recoveryCode: z.string().trim().max(64).optional().or(z.literal('')),
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
    if (!parsed.success) return '入力内容を確認してください。';

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
                    return 'メールアドレスまたはパスワードが正しくありません。';
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
        const blob = await put(`${pathPrefix}/${validation.objectName}`, file, {
            access: 'public',
        });
        return { url: blob.url } as const;
    } catch (error) {
        console.error('Failed to upload image:', error);
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
    const moderationState = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            status: true,
            suspendedUntil: true,
            restrictionUntil: true,
            restrictionReason: true,
        },
    });
    const now = new Date();
    if (moderationState?.status === AccountStatus.SUSPENDED) {
        if (!moderationState.suspendedUntil || moderationState.suspendedUntil > now) {
            return { message: moderationState.restrictionReason ?? 'アカウントが停止中のため投稿できません。' };
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: AccountStatus.ACTIVE,
                suspendedUntil: null,
                restrictionUntil: null,
                restrictionReason: null,
            },
        });
    }
    if (moderationState?.status === AccountStatus.POST_RESTRICTED) {
        if (moderationState.restrictionUntil && moderationState.restrictionUntil <= now) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    status: AccountStatus.ACTIVE,
                    restrictionUntil: null,
                    restrictionReason: null,
                },
            });
        } else {
            const untilLabel = moderationState.restrictionUntil
                ? moderationState.restrictionUntil.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
                : null;
            const baseMessage = moderationState.restrictionReason ?? '投稿が制限されています。';
            return {
                message: untilLabel ? `${baseMessage}（${untilLabel}まで）` : baseMessage,
            };
        }
    }
    if (!(await rateLimit(`create-post:${userId}`, 20, 60 * 1000))) {
        return { message: '投稿が多すぎます。少し待ってから再度お試しください。' };
    }

    const rawContent = formData.get('content');
    const content = typeof rawContent === 'string' ? rawContent.trim() : '';
    const image = formData.get('image');

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
        await prisma.$transaction(async (tx) => {
            const post = await tx.post.create({
                data: {
                    content: finalContent || '',
                    imageUrl,
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
        });
    } catch (error) {
        console.error('Failed to create post:', error);
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

    const post = await getAccessiblePostForViewer(userId, postId);
    if (!post) return;

    const removedLike = await prisma.like.deleteMany({
        where: { userId, postId },
    });

    if (removedLike.count > 0) {
        if (post?.authorId) {
            await prisma.notification.deleteMany({
                where: {
                    type: 'LIKE',
                    userId: post.authorId,
                    actorId: userId,
                    postId,
                },
            });
        }
    } else {
        const createdLike = await prisma.like.createMany({
            data: [{ userId, postId }],
            skipDuplicates: true,
        });
        if (createdLike.count === 1 && post.authorId && post.authorId !== userId) {
            await prisma.notification.create({
                data: {
                    type: 'LIKE',
                    userId: post.authorId,
                    actorId: userId,
                    postId,
                },
            });
        }
    }

    revalidatePath('/');
}

export async function addWakaru(postId: string) {
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
    if (!(await getAccessiblePostForViewer(userId, postId))) return;

    await prisma.$transaction(async (tx) => {
        const removedReaction = await tx.reaction.deleteMany({
            where: { userId, postId, type: 'WAKARU' },
        });
        const post = await tx.post.findUnique({
            where: { id: postId },
            select: { authorId: true, deletedAt: true, isHidden: true, author: { select: { status: true, suspendedUntil: true } } },
        });
        if (!post || post.deletedAt || post.isHidden || isSuspensionActive(post.author.status, post.author.suspendedUntil)) return;
        if (removedReaction.count > 0) {
            await tx.post.updateMany({
                where: { id: postId, wakaruCount: { gt: 0 } },
                data: { wakaruCount: { decrement: 1 } },
            });
            if (post?.authorId) {
                await tx.notification.deleteMany({
                    where: {
                        type: 'WAKARU',
                        userId: post.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        } else {
            const createdReaction = await tx.reaction.createMany({
                data: [{ userId, postId, type: 'WAKARU' }],
                skipDuplicates: true,
            });
            if (createdReaction.count === 1) {
                await tx.post.update({
                    where: { id: postId },
                    data: { wakaruCount: { increment: 1 } },
                });
            }
            if (createdReaction.count === 1 && post.authorId && post.authorId !== userId) {
                await tx.notification.create({
                    data: {
                        type: 'WAKARU',
                        userId: post.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        }
    });

    revalidatePath('/');
}

export async function addGanbatta(postId: string) {
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
    if (!(await getAccessiblePostForViewer(userId, postId))) return;

    await prisma.$transaction(async (tx) => {
        const removedReaction = await tx.reaction.deleteMany({
            where: { userId, postId, type: 'GANBATTA' },
        });
        const post = await tx.post.findUnique({
            where: { id: postId },
            select: { authorId: true, deletedAt: true, isHidden: true, author: { select: { status: true, suspendedUntil: true } } },
        });
        if (!post || post.deletedAt || post.isHidden || isSuspensionActive(post.author.status, post.author.suspendedUntil)) return;
        if (removedReaction.count > 0) {
            await tx.post.updateMany({
                where: { id: postId, ganbattaCount: { gt: 0 } },
                data: { ganbattaCount: { decrement: 1 } },
            });
            if (post?.authorId) {
                await tx.notification.deleteMany({
                    where: {
                        type: 'GANBATTA',
                        userId: post.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        } else {
            const createdReaction = await tx.reaction.createMany({
                data: [{ userId, postId, type: 'GANBATTA' }],
                skipDuplicates: true,
            });
            if (createdReaction.count === 1) {
                await tx.post.update({
                    where: { id: postId },
                    data: { ganbattaCount: { increment: 1 } },
                });
            }
            if (createdReaction.count === 1 && post.authorId && post.authorId !== userId) {
                await tx.notification.create({
                    data: {
                        type: 'GANBATTA',
                        userId: post.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        }
    });

    revalidatePath('/');
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

    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true, deletedAt: true },
    });
    if (!post || post.authorId !== userId || post.deletedAt) return;

    await prisma.$transaction([
        prisma.notification.deleteMany({ where: { postId } }),
        prisma.post.update({
            where: { id: postId },
            data: {
                deletedAt: new Date(),
                deletedById: userId,
            },
        }),
        prisma.auditLog.create({
            data: {
                action: 'POST_DELETE_SELF',
                actorUserId: userId,
                targetUserId: userId,
                meta: { postId },
            },
        }),
    ]);
    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/bookmarks');
    revalidatePath('/post');
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
    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, isPrivate: true, status: true, suspendedUntil: true },
    });
    if (
        !targetUser ||
        isSuspensionActive(targetUser.status, targetUser.suspendedUntil) ||
        (await usersAreBlocked(userId, targetUserId))
    ) return;

    const createdFollow = await prisma.follow.createMany({
        data: [{
            followerId: userId,
            followingId: targetUserId,
            acceptedAt: targetUser.isPrivate ? null : new Date(),
        }],
        skipDuplicates: true,
    });

    if (!targetUser.isPrivate) {
        await prisma.follow.updateMany({
            where: {
                followerId: userId,
                followingId: targetUserId,
                acceptedAt: null,
            },
            data: { acceptedAt: new Date() },
        });
    }

    if (createdFollow.count === 1) {
        await prisma.notification.create({
            data: {
                type: 'FOLLOW',
                userId: targetUserId,
                actorId: userId,
            },
        });
    }

    revalidatePath('/');
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

    await prisma.follow.deleteMany({
        where: {
            followerId: userId,
            followingId: targetUserId,
        },
    });

    await prisma.notification.deleteMany({
        where: {
            type: 'FOLLOW',
            userId: targetUserId,
            actorId: userId,
        },
    });

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

    await prisma.follow.updateMany({
        where: {
            followerId,
            followingId: userId,
            acceptedAt: null,
        },
        data: { acceptedAt: new Date() },
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

    await prisma.$transaction([
        prisma.follow.deleteMany({
            where: {
                followerId,
                followingId: userId,
                acceptedAt: null,
            },
        }),
        prisma.notification.deleteMany({
            where: {
                type: 'FOLLOW',
                userId,
                actorId: followerId,
            },
        }),
    ]);

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

    await prisma.$transaction([
        prisma.follow.deleteMany({
            where: {
                followerId,
                followingId: userId,
                acceptedAt: { not: null },
            },
        }),
        prisma.notification.deleteMany({
            where: {
                type: 'FOLLOW',
                userId,
                actorId: followerId,
            },
        }),
    ]);

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
    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
    });
    if (!targetUser) return;

    await prisma.$transaction([
        prisma.block.upsert({
            where: {
                blockerId_blockedId: {
                    blockerId: userId,
                    blockedId: targetUserId,
                },
            },
            update: {},
            create: {
                blockerId: userId,
                blockedId: targetUserId,
            },
        }),
        prisma.follow.deleteMany({
            where: {
                OR: [
                    { followerId: userId, followingId: targetUserId },
                    { followerId: targetUserId, followingId: userId },
                ],
            },
        }),
        prisma.notification.deleteMany({
            where: {
                type: 'FOLLOW',
                OR: [
                    { userId: targetUserId, actorId: userId },
                    { userId, actorId: targetUserId },
                ],
            },
        }),
    ]);

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

    await prisma.block.deleteMany({
        where: { blockerId: userId, blockedId: targetUserId },
    });

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
    const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
    });
    if (!targetUser) return;

    await prisma.mute.upsert({
        where: {
            muterId_mutedId: {
                muterId: userId,
                mutedId: targetUserId,
            },
        },
        update: {},
        create: {
            muterId: userId,
            mutedId: targetUserId,
        },
    });

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/mutes');
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

    await prisma.mute.deleteMany({
        where: { muterId: userId, mutedId: targetUserId },
    });

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
    name: z.string().trim().max(50, '名前は50文字以内です。').optional(),
    bio: z.string().trim().max(500, '自己紹介は500文字以内です。').optional(),
    autoHashtag: z.string().trim().max(100, '自動ハッシュタグは100文字以内です。').optional(),
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

    const profile = ProfileSchema.safeParse({
        name: typeof formData.get('name') === 'string' ? String(formData.get('name')) : undefined,
        bio: typeof formData.get('bio') === 'string' ? String(formData.get('bio')) : undefined,
        autoHashtag:
            typeof formData.get('autoHashtag') === 'string' ? String(formData.get('autoHashtag')) : undefined,
    });
    if (!profile.success) {
        return { message: profile.error.issues[0]?.message ?? 'プロフィールの入力内容が不正です。' };
    }

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
        if ('error' in upload) return { message: upload.error ?? '画像のアップロードに失敗しました。' };
        headerUrl = upload.url;
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            name: name && name.length > 0 ? name : undefined,
            bio: bio && bio.length > 0 ? bio : undefined,
            autoHashtag: autoHashtag && autoHashtag.length > 0 ? autoHashtag : null,
            avatarUrl,
            headerUrl,
        },
    });

    revalidatePath('/profile');
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

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isPrivate: true },
    });
    const nextValue = !(user?.isPrivate ?? false);

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { isPrivate: nextValue },
        });

        if (!nextValue) {
            await tx.follow.updateMany({
                where: {
                    followingId: userId,
                    acceptedAt: null,
                },
                data: { acceptedAt: new Date() },
            });
        }
    });

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath('/profile/following');
    revalidatePath('/profile/followers');
    revalidatePath('/notifications');
}

export async function toggleBookmark(postId: string) {
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

    const post = await getAccessiblePostForViewer(userId, postId);
    if (!post) return;

    const removedBookmark = await prisma.bookmark.deleteMany({
        where: { userId, postId },
    });

    if (removedBookmark.count > 0) {
    } else {
        await prisma.bookmark.createMany({
            data: [{ userId, postId }],
            skipDuplicates: true,
        });
    }

    revalidatePath('/');
    revalidatePath('/bookmarks');
}

export async function deleteSelfTestResult(
    testType: 'ybocs' | 'iesr' | 'itq' | 'lsas',
    resultId: string,
) {
    const session = await auth();
    let userId = session?.user?.id;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id;
    }
    if (!userId || !resultId) return;
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

function parseScore(value: FormDataEntryValue | null) {
    if (typeof value !== 'string') return null;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return null;
    return parsed;
}

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

    const parsedScores = Array.from({ length: 10 }, (_, i) => parseScore(formData.get(`q${i + 1}`)));
    if (parsedScores.some((score) => score === null || score < 0 || score > 5)) {
        return { message: 'すべての設問に0〜5で回答してください。' };
    }

    const scores = parsedScores as number[];
    const cgiI = parseScore(formData.get('cgiI'));
    const cgiS = parseScore(formData.get('cgiS'));
    if ((cgiI !== null && (cgiI < 1 || cgiI > 7)) || (cgiS !== null && (cgiS < 1 || cgiS > 7))) {
        return { message: 'CGIは1〜7で回答してください。' };
    }
    const obsessionsScore = scores.slice(0, 5).reduce((sum, val) => sum + (val ?? 0), 0);
    const compulsionsScore = scores.slice(5).reduce((sum, val) => sum + (val ?? 0), 0);
    const totalScore = obsessionsScore + compulsionsScore;

    const symptomsCurrent = formData.getAll('symptom_current').filter((v) => typeof v === 'string') as string[];
    const symptomsPast = formData.getAll('symptom_past').filter((v) => typeof v === 'string') as string[];

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
        console.error('Failed to save Y-BOCS result:', error);
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

    const parsedScores = Array.from({ length: 22 }, (_, i) => parseScore(formData.get(`q${i + 1}`)));
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
        console.error('Failed to save IES-R result:', error);
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

    const eventTiming =
        typeof formData.get('eventTiming') === 'string' ? String(formData.get('eventTiming')) : '';
    if (!eventTiming) {
        return { message: '経験の時期を選択してください。' };
    }

    const pScores = Array.from({ length: 9 }, (_, i) => parseScore(formData.get(`p${i + 1}`)));
    const cScores = Array.from({ length: 9 }, (_, i) => parseScore(formData.get(`c${i + 1}`)));

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
        console.error('Failed to save ITQ result:', error);
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

    const fearScores = Array.from({ length: 24 }, (_, i) => parseScore(formData.get(`f${i + 1}`)));
    const avoidScores = Array.from({ length: 24 }, (_, i) => parseScore(formData.get(`a${i + 1}`)));

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
        console.error('Failed to save LSAS result:', error);
        return { message: '結果の保存に失敗しました。' };
    }

    revalidatePath('/test');
    return { message: '結果を保存しました。' };
}
