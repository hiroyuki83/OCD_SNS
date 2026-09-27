'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { AccountStatus, Role } from '@prisma/client';
import { auth, signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { parseAccountDeletionInput } from '@/lib/accountDeletionInput';
import { deleteManagedBlobs } from '@/lib/blobCleanup';
import { parseEmailChangeInput } from '@/lib/emailChangeInput';
import { isEmailDeliveryConfigured } from '@/lib/email';
import { sendEmailChangeVerification } from '@/lib/emailVerification';
import { logOperationalError } from '@/lib/operationalError';

export type EmailChangeState =
  | { ok?: boolean; message?: string }
  | undefined;

export async function requestEmailChange(
  _prevState: EmailChangeState,
  formData: FormData,
): Promise<EmailChangeState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { message: 'ログインしてください。' };

  if (!(await rateLimit(`email-change:${userId}`, 3, 60 * 60 * 1000))) {
    return { message: 'メール変更の試行が多すぎます。時間をおいて再度お試しください。' };
  }

  const parsed = parseEmailChangeInput(
    formData.get('currentPassword'),
    formData.get('newEmail'),
  );
  if (!parsed.ok) return { message: parsed.message };
  if (!isEmailDeliveryConfigured()) {
    return { message: '現在メール送信を利用できません。管理者にお問い合わせください。' };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, password: true },
  });
  if (!user || !(await bcrypt.compare(parsed.currentPassword, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }
  if (parsed.newEmail === user.email.toLowerCase()) {
    return { message: '現在とは異なるメールアドレスを入力してください。' };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.newEmail },
    select: { id: true },
  });
  if (existing && existing.id !== userId) {
    return { message: 'このメールアドレスは利用できません。' };
  }

  try {
    await sendEmailChangeVerification({
      id: userId,
      newEmail: parsed.newEmail,
    });
  } catch (error) {
    logOperationalError('EMAIL_CHANGE_DELIVERY_FAILED', error);
    return { message: '確認メールを送信できませんでした。時間をおいて再度お試しください。' };
  }

  return {
    ok: true,
    message: '新しいメールアドレスへ確認メールを送信しました。リンクを開くまで変更は確定しません。',
  };
}

class AccountDeletionConflictError extends Error {}

export type AccountDeletionState =
  | { ok?: boolean; message?: string }
  | undefined;

export async function deleteOwnAccount(
  _prevState: AccountDeletionState,
  formData: FormData,
): Promise<AccountDeletionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { message: 'ログインしてください。' };

  if (!(await rateLimit(`account-delete:${userId}`, 3, 24 * 60 * 60 * 1000))) {
    return { message: '削除操作の試行が多すぎます。時間をおいて再度お試しください。' };
  }

  const parsed = parseAccountDeletionInput(
    formData.get('currentPassword'),
    formData.get('confirmation'),
  );
  if (!parsed.ok) return { message: parsed.message };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      password: true,
      role: true,
      sessionVersion: true,
      avatarUrl: true,
      headerUrl: true,
    },
  });
  if (!user || !(await bcrypt.compare(parsed.currentPassword, user.password))) {
    return { message: '現在のパスワードを確認できませんでした。' };
  }

  if (user.role !== Role.USER) {
    return {
      message:
        'ADMIN / MODERATOR アカウントは設定画面から削除できません。先に通常ユーザーへ権限変更してください。',
    };
  }

  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    select: { id: true, imageUrl: true },
  });
  const postIds = posts.map((post) => post.id);
  const blobUrls = [
    user.avatarUrl,
    user.headerUrl,
    ...posts.map((post) => post.imageUrl),
  ];

  const deletedAt = new Date();
  const replacementPassword = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 10);
  const deletedEmail = `deleted-${user.id}@deleted.invalid`;
  const deletedHandle = `deleted-${user.id}`;

  let deleted = false;
  try {
    deleted = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: { role: true, sessionVersion: true },
    });
    if (
      !current ||
      current.role !== Role.USER ||
      current.sessionVersion !== user.sessionVersion
    ) {
      throw new AccountDeletionConflictError();
    }

    await tx.notification.deleteMany({
      where: {
        OR: [
          { userId },
          { actorId: userId },
          ...(postIds.length > 0 ? [{ postId: { in: postIds } }] : []),
        ],
      },
    });
    await tx.like.deleteMany({
      where: {
        OR: [
          { userId },
          ...(postIds.length > 0 ? [{ postId: { in: postIds } }] : []),
        ],
      },
    });
    await tx.bookmark.deleteMany({
      where: {
        OR: [
          { userId },
          ...(postIds.length > 0 ? [{ postId: { in: postIds } }] : []),
        ],
      },
    });
    await tx.reaction.deleteMany({
      where: {
        OR: [
          { userId },
          ...(postIds.length > 0 ? [{ postId: { in: postIds } }] : []),
        ],
      },
    });

    await tx.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    });
    await tx.block.deleteMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    await tx.mute.deleteMany({
      where: { OR: [{ muterId: userId }, { mutedId: userId }] },
    });

    await Promise.all([
      tx.ybocsResult.deleteMany({ where: { userId } }),
      tx.iesrResult.deleteMany({ where: { userId } }),
      tx.itqResult.deleteMany({ where: { userId } }),
      tx.lsasResult.deleteMany({ where: { userId } }),
      tx.passwordResetToken.deleteMany({ where: { userId } }),
      tx.emailVerificationToken.deleteMany({ where: { userId } }),
      tx.staffRecoveryCode.deleteMany({ where: { userId } }),
    ]);

    await tx.warningAppeal.updateMany({
      where: { userId },
      data: { message: '[削除済みユーザーによる異議申立て]' },
    });
    await tx.report.updateMany({
      where: { reporterId: userId },
      data: { detail: null },
    });

    if (postIds.length > 0) {
      await tx.post.updateMany({
        where: { id: { in: postIds }, authorId: userId },
        data: {
          content: '[削除済み]',
          imageUrl: null,
          imageAlt: null,
          deletedAt,
          deletedById: userId,
          isHidden: false,
          hiddenAt: null,
          hiddenReason: null,
          hiddenById: null,
        },
      });
    }

    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        role: Role.USER,
        sessionVersion: user.sessionVersion,
      },
      data: {
        email: deletedEmail,
        handle: deletedHandle,
        emailVerifiedAt: null,
        password: replacementPassword,
        name: '削除済みユーザー',
        bio: null,
        avatarUrl: null,
        headerUrl: null,
        autoHashtag: null,
        isPrivate: true,
        notifyLikes: false,
        notifyReactions: false,
        notifyFollows: false,
        status: AccountStatus.SUSPENDED,
        restrictionReason: 'ACCOUNT_DELETED',
        restrictionUntil: null,
        suspendedUntil: null,
        staffTotpSecretEncrypted: null,
        staffTotpEnabledAt: null,
        staffTotpLastUsedStep: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new AccountDeletionConflictError();

    await tx.auditLog.create({
      data: {
        action: 'ACCOUNT_DELETED',
        actorUserId: userId,
        targetUserId: userId,
        meta: {
          deletedAt,
          mode: 'ANONYMIZED',
          sessionsRevoked: true,
          postsScrubbed: postIds.length,
        },
      },
    });

    return true;
    });
  } catch (error) {
    if (error instanceof AccountDeletionConflictError) {
      return {
        message: 'アカウント状態が変更されました。画面を更新して再度お試しください。',
      };
    }
    throw error;
  }

  if (!deleted) {
    return {
      message: 'アカウント状態が変更されました。画面を更新して再度お試しください。',
    };
  }

  await deleteManagedBlobs(blobUrls);
  await signOut({ redirectTo: '/login?account=deleted' });
  return { ok: true, message: 'アカウントを削除しました。' };
}
