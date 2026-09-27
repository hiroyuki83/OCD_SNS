'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { isEmailDeliveryConfigured } from '@/lib/email';
import { hashVerificationToken, sendEmailVerification } from '@/lib/emailVerification';
import { logOperationalError } from '@/lib/operationalError';

const tokenSchema = z.string().min(32).max(256);
const emailSchema = z.string().trim().toLowerCase().max(254, 'メールアドレスが長すぎます。').email('正しいメールアドレスを入力してください。');

class EmailVerificationConflictError extends Error {}

export type VerifyEmailState =
    | { ok?: boolean; message?: string; errors?: { email?: string[] } }
    | undefined;

export async function verifyEmail(
    _prevState: VerifyEmailState,
    formData: FormData,
): Promise<VerifyEmailState> {
    const parsed = tokenSchema.safeParse(formData.get('token'));
    if (!parsed.success) return { message: '確認リンクが正しくありません。' };

    const verificationHash = hashVerificationToken(parsed.data);
    if (!(await rateLimit(`email-verify-token:${verificationHash.slice(0, 16)}`, 10, 15 * 60 * 1000))) {
        return { message: '確認の試行が多すぎます。しばらくしてから再度お試しください。' };
    }

    const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash: verificationHash },
        select: { id: true, userId: true, usedAt: true, expiresAt: true, pendingEmail: true },
    });

    if (!record || record.usedAt || record.expiresAt <= new Date()) {
        return { message: '確認リンクは無効または期限切れです。再送をお試しください。' };
    }

    const verifiedAt = new Date();

    const pendingEmail = record.pendingEmail;
    if (pendingEmail) {
        try {
            await prisma.$transaction(async (tx) => {
                const consumed = await tx.emailVerificationToken.updateMany({
                    where: {
                        id: record.id,
                        userId: record.userId,
                        usedAt: null,
                        expiresAt: { gt: verifiedAt },
                        pendingEmail: pendingEmail,
                    },
                    data: { usedAt: verifiedAt },
                });
                if (consumed.count !== 1) throw new EmailVerificationConflictError();

                const existing = await tx.user.findUnique({
                    where: { email: pendingEmail },
                    select: { id: true },
                });
                if (existing && existing.id !== record.userId) throw new EmailVerificationConflictError();

                const updated = await tx.user.updateMany({
                    where: { id: record.userId },
                    data: {
                        email: pendingEmail,
                        emailVerifiedAt: verifiedAt,
                        sessionVersion: { increment: 1 },
                    },
                });
                if (updated.count !== 1) throw new EmailVerificationConflictError();

                await tx.emailVerificationToken.updateMany({
                    where: {
                        userId: record.userId,
                        usedAt: null,
                    },
                    data: { usedAt: verifiedAt },
                });

                await tx.auditLog.create({
                    data: {
                        action: 'EMAIL_CHANGED',
                        actorUserId: record.userId,
                        targetUserId: record.userId,
                        meta: {
                            changedAt: verifiedAt,
                            sessionsRevoked: true,
                        },
                    },
                });
                return true;
            });

            return {
                ok: true,
                message: 'メールアドレスを変更しました。新しいメールアドレスでログインしてください。',
            };
        } catch (error) {
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                return { message: 'このメールアドレスは利用できません。' };
            }
            if (error instanceof EmailVerificationConflictError) {
                return { message: 'このメールアドレスは利用できないか、確認リンクが既に使用されています。' };
            }
            throw error;
        }
    }

    try {
        await prisma.$transaction(async (tx) => {
        const consumed = await tx.emailVerificationToken.updateMany({
            where: {
                id: record.id,
                userId: record.userId,
                usedAt: null,
                expiresAt: { gt: verifiedAt },
                pendingEmail: null,
            },
            data: { usedAt: verifiedAt },
        });
        if (consumed.count !== 1) throw new EmailVerificationConflictError();

        const verified = await tx.user.updateMany({
            where: {
                id: record.userId,
                emailVerifiedAt: null,
            },
            data: { emailVerifiedAt: verifiedAt },
        });
        if (verified.count !== 1) throw new EmailVerificationConflictError();

        await tx.emailVerificationToken.updateMany({
            where: {
                userId: record.userId,
                usedAt: null,
            },
            data: { usedAt: verifiedAt },
        });

        await tx.auditLog.create({
            data: {
                action: 'EMAIL_VERIFY',
                actorUserId: record.userId,
                targetUserId: record.userId,
                meta: { verifiedAt },
            },
        });

        return true;
    });
    } catch (error) {
        if (error instanceof EmailVerificationConflictError) {
            return { message: '確認リンクは無効または既に使用されています。再送をお試しください。' };
        }
        throw error;
    }

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
            logOperationalError('EMAIL_VERIFICATION_RESEND_FAILED', error);
        }
    }

    return { ok: true, message: genericMessage };
}
