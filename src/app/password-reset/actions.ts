'use server';

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/email';

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください。'),
});

const resetSchema = z
  .object({
    token: z.string().min(32),
    password: z.string().min(10, 'パスワードは10文字以上です。').max(128, 'パスワードは128文字以内です。'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: '確認用パスワードが一致しません。',
  });

export type RequestPasswordResetState =
  | {
      errors?: { email?: string[] };
      message?: string;
      ok?: boolean;
    }
  | undefined;

export type ResetPasswordState =
  | {
      errors?: {
        password?: string[];
        confirmPassword?: string[];
      };
      message?: string;
      ok?: boolean;
    }
  | undefined;

const genericRequestMessage =
  '登録済みのメールアドレスであれば、パスワード再設定用のメールを送信しました。';

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function appOrigin() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await sendTransactionalEmail({
    to: email,
    subject: 'CoCo パスワード再設定',
    text: [
      'CoCo のパスワード再設定リクエストを受け付けました。',
      '',
      '以下のリンクから1時間以内に新しいパスワードを設定してください。',
      resetUrl,
      '',
      'このメールに心当たりがない場合は、何もしないでください。',
    ].join('\n'),
  });
}

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const parsed = requestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const email = parsed.data.email;
  if (!(await rateLimit(`password-reset:${email}`, 3, 60 * 60 * 1000))) {
    return { ok: true, message: genericRequestMessage };
  }
  if (!isEmailDeliveryConfigured()) {
    return { message: '現在メール送信を利用できません。管理者にお問い合わせください。' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    return { ok: true, message: genericRequestMessage };
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt,
      },
    }),
  ]);

  const resetUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (error) {
    console.error(error);
  }

  return { ok: true, message: genericRequestMessage };
}

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: '入力内容を確認してください。',
    };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(parsed.data.token) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { email: true } },
    },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    return { message: 'この再設定リンクは無効または期限切れです。' };
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword, emailVerifiedAt: new Date() },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        action: 'PASSWORD_RESET_SELF',
        actorUserId: resetToken.userId,
        targetUserId: resetToken.userId,
        meta: {
          email: resetToken.user.email,
        },
      },
    }),
  ]);

  return { ok: true, message: 'パスワードを再設定しました。新しいパスワードでログインしてください。' };
}
