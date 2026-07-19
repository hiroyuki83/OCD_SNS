import 'server-only';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendTransactionalEmail } from '@/lib/email';

export function hashVerificationToken(token: string) {
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

export async function sendEmailVerification(user: { id: string; email: string }) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction([
        prisma.emailVerificationToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        }),
        prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                tokenHash: hashVerificationToken(token),
                expiresAt,
            },
        }),
    ]);

    const verificationUrl = `${appOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
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
}
