'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { isEmailDeliveryConfigured } from '@/lib/email';
import { hashVerificationToken, sendEmailVerification } from '@/lib/emailVerification';

const tokenSchema = z.string().min(32);
const emailSchema = z.string().trim().toLowerCase().email('正しいメールアドレスを入力してください。');

export type VerifyEmailState =
    | { ok?: boolean; message?: string; errors?: { email?: string[] } }
    | undefined;

export async function verifyEmail(
    _prevState: VerifyEmailState,
    formData: FormData,
): Promise<VerifyEmailState> {
    const parsed = tokenSchema.safeParse(formData.get('token'));
    if (!parsed.success) return { message: '確認リンクが正しくありません。' };

    const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: hashVerificationToken(parsed.data) },
        select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
        return { message: '確認リンクは無効または期限切れです。再送をお試しください。' };
    }

    const verifiedAt = new Date();
    await prisma.$transaction([
        prisma.user.update({
            where: { id: record.userId },
            data: { emailVerifiedAt: verifiedAt },
        }),
        prisma.emailVerificationToken.updateMany({
            where: { userId: record.userId, usedAt: null },
            data: { usedAt: verifiedAt },
        }),
        prisma.auditLog.create({
            data: {
                action: 'EMAIL_VERIFY',
                actorUserId: record.userId,
                targetUserId: record.userId,
                meta: { verifiedAt },
            },
        }),
    ]);

    return { ok: true, message: 'メールアドレスを確認しました。ログインできます。' };
}

export async function requestEmailVerification(
    _prevState: VerifyEmailState,
    formData: FormData,
): Promise<VerifyEmailState> {
    const parsed = emailSchema.safeParse(formData.get('email'));
    if (!parsed.success) {
        return { errors: { email: parsed.error.flatten().formErrors }, message: '入力内容を確認してください。' };
    }

    const genericMessage = '未確認の登録メールアドレスであれば、確認メールを送信しました。';
    if (!(await rateLimit(`email-verification:${parsed.data}`, 3, 60 * 60 * 1000))) {
        return { ok: true, message: genericMessage };
    }
    if (!isEmailDeliveryConfigured()) {
        return { message: '現在メール送信を利用できません。管理者にお問い合わせください。' };
    }

    const user = await prisma.user.findUnique({
        where: { email: parsed.data },
        select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (user && !user.emailVerifiedAt) {
        try {
            await sendEmailVerification(user);
        } catch (error) {
            console.error('Failed to resend verification email:', error);
        }
    }

    return { ok: true, message: genericMessage };
}
