'use server';

import crypto from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/email';

const CreateUserSchema = z.object({
  name: z.string().trim().max(50, '名前は50文字以内です。').optional(),
  email: z.string().trim().toLowerCase().max(254, 'メールアドレスが長すぎます。').email('正しいメールアドレスを入力してください。'),
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
  currentPassword: z.string().min(1, '現在のADMINパスワードを入力してください。').max(128),
  adminConfirmation: z.string().trim().max(64).optional(),
});

function normalizeAdminNote(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

const AdminNoteSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  body: z
    .string()
    .transform(normalizeAdminNote)
    .refine((value) => Array.from(value).length >= 1, 'メモ本文を入力してください。')
    .refine((value) => Array.from(value).length <= 1000, 'メモは1000文字以内です。'),
});

const AdminPasswordResetSchema = z.object({
  userId: z.string().trim().min(1).max(128),
  currentPassword: z
    .string()
    .min(1, '現在のADMINパスワードを入力してください。')
    .max(128),
});

export type CreateUserState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        role?: string[];
        currentPassword?: string[];
        adminConfirmation?: string[];
      };
      message?: string;
    }
  | undefined;

export type ResetPasswordState =
  | {
      message?: string;
      ok?: boolean;
    }
  | undefined;

export type AdminNoteState =
  | {
      errors?: {
        body?: string[];
      };
      message?: string;
      ok?: boolean;
    }
  | undefined;

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function appOrigin() {
  const configuredOrigin = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function createAdminUser(
  _prevState: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const actor = await requireRole(Role.ADMIN);
  if (!(await rateLimit(`admin-user-create:${actor.id}`, 10, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const parsed = CreateUserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    role: formData.get('role'),
    currentPassword: formData.get('currentPassword'),
    adminConfirmation: formData.get('adminConfirmation'),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const actorAccount = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { password: true },
  });
  if (
    !actorAccount ||
    !(await bcrypt.compare(parsed.data.currentPassword, actorAccount.password))
  ) {
    return { message: '現在のADMINパスワードを確認できませんでした。' };
  }

  if (
    parsed.data.role === Role.ADMIN &&
    parsed.data.adminConfirmation !== 'CREATE ADMIN'
  ) {
    return { message: 'ADMIN作成には確認文字列「CREATE ADMIN」が必要です。' };
  }

  if (!isEmailDeliveryConfigured()) {
    return {
      message:
        '招待メールを送信できないため、ユーザーを作成できません。メール設定を確認してください。',
    };
  }

  const { email, role } = parsed.data;
  const name = parsed.data.name?.trim() || null;
  const temporarySecret = crypto.randomBytes(48).toString('base64url');
  const hashedPassword = await bcrypt.hash(temporarySecret, 10);
  const inviteToken = crypto.randomBytes(32).toString('base64url');
  const inviteExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  let createdUserId: string;
  try {
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          emailVerifiedAt: null,
          password: hashedPassword,
          role,
        },
        select: { id: true, email: true, role: true },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: tokenHash(inviteToken),
          expiresAt: inviteExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'USER_INVITE_CREATED',
          actorUserId: actor.id,
          targetUserId: user.id,
          meta: {
            role: user.role,
            inviteExpiresAt,
          },
        },
      });

      return user;
    });
    createdUserId = createdUser.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { message: 'このメールアドレスは既に使用されています。' };
    }

    console.error('Failed to create admin-managed user:', error);
    return { message: 'ユーザー作成に失敗しました。' };
  }

  const inviteUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(inviteToken)}`;
  try {
    await sendTransactionalEmail({
      to: email,
      subject: 'CoCo アカウント招待',
      text: [
        'CoCo のアカウントが作成されました。',
        '',
        '以下のリンクから24時間以内に、ご自身でパスワードを設定してください。',
        inviteUrl,
        '',
        'この招待に心当たりがない場合は、このメールを破棄してください。',
      ].join('\n'),
    });
  } catch (error) {
    console.error('Failed to send admin-created user invitation:', error);
    await prisma.passwordResetToken.updateMany({
      where: {
        tokenHash: tokenHash(inviteToken),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    return {
      message:
        'ユーザーは作成されましたが、招待メールの送信に失敗しました。ユーザー詳細から再設定メールを送信してください。',
    };
  }

  revalidatePath('/admin');
  revalidatePath('/admin/users');
  revalidatePath('/admin/audit');
  redirect(`/admin/users/${createdUserId}`);
}

export async function resetUserPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const actor = await requireRole(Role.ADMIN);
  if (!(await rateLimit(`admin-password-reset:${actor.id}`, 20, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const parsed = AdminPasswordResetSchema.safeParse({
    userId: formData.get('userId'),
    currentPassword: formData.get('currentPassword'),
  });
  if (!parsed.success) {
    return { message: 'ユーザーIDと現在のADMINパスワードを確認してください。' };
  }

  const actorAccount = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { password: true },
  });
  if (
    !actorAccount ||
    !(await bcrypt.compare(parsed.data.currentPassword, actorAccount.password))
  ) {
    return { message: '現在のADMINパスワードを確認できませんでした。' };
  }

  const userId = parsed.data.userId;
  if (!isEmailDeliveryConfigured()) {
    return { message: '現在メール送信を利用できません。' };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) {
    return { message: 'ユーザーが見つかりません。' };
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: target.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: target.id,
        tokenHash: tokenHash(token),
        expiresAt,
      },
    }),
    prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_EMAIL_REQUESTED',
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: {
          role: target.role,
          expiresAt,
        },
      },
    }),
  ]);

  const resetUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendTransactionalEmail({
      to: target.email,
      subject: 'CoCo パスワード再設定',
      text: [
        'CoCo の管理者からパスワード再設定リンクが発行されました。',
        '',
        '以下のリンクから1時間以内に新しいパスワードを設定してください。',
        resetUrl,
        '',
        'このメールに心当たりがない場合は、運営へお問い合わせください。',
      ].join('\n'),
    });
  } catch (error) {
    console.error('Failed to send admin password reset email:', error);
    await prisma.passwordResetToken.updateMany({
      where: {
        tokenHash: tokenHash(token),
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
    return { message: '再設定メールの送信に失敗しました。' };
  }

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/audit');
  return {
    ok: true,
    message: '本人の登録メールアドレスへ再設定リンクを送信しました。',
  };
}

export async function createAdminNote(
  _prevState: AdminNoteState,
  formData: FormData,
): Promise<AdminNoteState> {
  const actor = await requireRole(Role.ADMIN);
  if (!(await rateLimit(`admin-note:${actor.id}`, 60, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const parsed = AdminNoteSchema.safeParse({
    userId: formData.get('userId'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) {
    return { message: 'ユーザーが見つかりません。' };
  }

  await prisma.$transaction(async (tx) => {
    const note = await tx.adminNote.create({
      data: {
        targetUserId: target.id,
        authorId: actor.id,
        body: parsed.data.body,
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        action: 'ADMIN_NOTE_CREATE',
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: { noteId: note.id },
      },
    });
  });

  revalidatePath(`/admin/users/${target.id}`);
  revalidatePath('/admin/audit');
  return { ok: true, message: '管理者メモを追加しました。' };
}
