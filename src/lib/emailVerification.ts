import 'server-only';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';
import { appOrigin } from '@/lib/appOrigin';

export function hashVerificationToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}


async function createVerificationToken(userId: string, pendingEmail: string | null) {
  const token = crypto.randomBytes(32).toString('base64url');
  const hashedToken = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const invalidatedAt = new Date();

  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: invalidatedAt },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hashedToken,
        pendingEmail,
        expiresAt,
      },
    }),
  ]);

  return { token, hashedToken };
}

async function invalidateFailedToken(hashedToken: string) {
  await prisma.emailVerificationToken.updateMany({
    where: { tokenHash: hashedToken, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function sendEmailVerification(user: { id: string; email: string }) {
  const { token, hashedToken } = await createVerificationToken(user.id, null);
  const verificationUrl = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;

  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: 'CoCo メールアドレスの確認',
      text: [
        'CoCoへの登録ありがとうございます。',
        '',
        '以下のリンクを開き、24時間以内にメールアドレスを確認してください。',
        verificationUrl,
        '',
        'このメールに心当たりがない場合は、何もしないでください。',
      ].join('\n'),
    });
  } catch (error) {
    await invalidateFailedToken(hashedToken);
    throw error;
  }
}

export async function sendEmailChangeVerification(user: {
  id: string;
  newEmail: string;
}) {
  const { token, hashedToken } = await createVerificationToken(user.id, user.newEmail);
  const verificationUrl = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;

  try {
    await sendTransactionalEmail({
      to: user.newEmail,
      subject: 'CoCo メールアドレス変更の確認',
      text: [
        'CoCoのメールアドレス変更が申請されました。',
        '',
        'このアドレスへ変更する場合は、以下のリンクを24時間以内に開いて確認してください。',
        verificationUrl,
        '',
        '心当たりがない場合はリンクを開かず、このメールを破棄してください。',
      ].join('\n'),
    });
  } catch (error) {
    await invalidateFailedToken(hashedToken);
    throw error;
  }
}
