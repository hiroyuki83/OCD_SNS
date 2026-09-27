import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { AccountStatus, Role } from '@prisma/client';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';
import { hashRecoveryCode, normalizeRecoveryCode } from '@/lib/recoveryCodes';
import { getNormalizedAccountModerationState } from '@/lib/accountModeration';
import { logOperationalError } from '@/lib/operationalError';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const DUMMY_PASSWORD_HASH =
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

async function getUser(email: string) {
    try {
        return await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    } catch (error) {
        logOperationalError('AUTH_USER_LOOKUP_FAILED', error);
        throw new Error('Failed to fetch user.');
    }
}

const nextAuthResult = NextAuth({
    ...authConfig,
    session: {
        strategy: 'jwt',
        maxAge: SESSION_MAX_AGE_SECONDS,
    },
    jwt: {
        maxAge: SESSION_MAX_AGE_SECONDS,
    },
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            if (user?.id) {
                token.id = user.id;
                token.sub = user.id;

                const roleValue = (user as { role?: Role }).role;
                if (roleValue) token.role = roleValue;

                const sessionVersion = (user as { sessionVersion?: number }).sessionVersion;
                if (typeof sessionVersion === 'number') {
                    token.sessionVersion = sessionVersion;
                }
                return token;
            }

            const tokenUserId = (token.id ?? token.sub) as string | undefined;
            if (!tokenUserId) return null;

            const currentUser = await getNormalizedAccountModerationState(tokenUserId);
            if (!currentUser) return null;

            if (typeof token.sessionVersion !== 'number') {
                if (currentUser.sessionVersion !== 0) return null;
                token.sessionVersion = 0;
            } else if (token.sessionVersion !== currentUser.sessionVersion) {
                return null;
            }

            if (currentUser.status === AccountStatus.SUSPENDED) {
                return null;
            }

            token.role = currentUser.role;
            return token;
        },
        async session({ session, token }) {
            if (session.user && (token?.id || token?.sub)) {
                session.user.id = (token.id ?? token.sub) as string;
            }
            if (session.user && token?.role) {
                session.user.role = token.role as Role;
            }
            return session;
        },
    },
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({
                        email: z.string().trim().toLowerCase().max(254).email(),
                        password: z.string().min(6).max(128),
                        totpCode: z.string().trim().regex(/^\d{6}$/).optional().or(z.literal('')),
                        recoveryCode: z.string().trim().max(64).optional(),
                    })
                    .safeParse(credentials);

                if (!parsedCredentials.success) return null;

                const { email, password, totpCode, recoveryCode } = parsedCredentials.data;
                if (totpCode && recoveryCode) return null;
                if (!(await rateLimit(`login:${email}`, 10, 15 * 60 * 1000))) {
                    return null;
                }

                const user = await getUser(email);
                const passwordMatches = await bcrypt.compare(
                    password,
                    user?.password ?? DUMMY_PASSWORD_HASH,
                );
                if (!user || !passwordMatches || !user.emailVerifiedAt) return null;

                const moderationState = await getNormalizedAccountModerationState(user.id);
                if (!moderationState || moderationState.status === AccountStatus.SUSPENDED) {
                    return null;
                }

                const isStaff =
                    moderationState.role === Role.ADMIN ||
                    moderationState.role === Role.MODERATOR;
                if (isStaff && user.staffTotpEnabledAt) {
                    if (!(await rateLimit(`staff-mfa-login:${user.id}`, 10, 15 * 60 * 1000))) {
                        return null;
                    }

                    if (recoveryCode) {
                        const normalizedRecoveryCode = normalizeRecoveryCode(recoveryCode);
                        if (normalizedRecoveryCode.length !== 16) return null;
                        const codeHash = hashRecoveryCode(normalizedRecoveryCode);
                        const recovery = await prisma.staffRecoveryCode.findFirst({
                            where: {
                                userId: user.id,
                                codeHash,
                                usedAt: null,
                            },
                            select: { id: true },
                        });
                        if (!recovery) return null;

                        const consumed = await prisma.$transaction(async (tx) => {
                            const currentSecurity = await tx.user.findUnique({
                                where: { id: user.id },
                                select: {
                                    role: true,
                                    staffTotpEnabledAt: true,
                                },
                            });
                            if (
                                !currentSecurity ||
                                (currentSecurity.role !== Role.ADMIN &&
                                    currentSecurity.role !== Role.MODERATOR) ||
                                currentSecurity.staffTotpEnabledAt?.getTime() !==
                                    user.staffTotpEnabledAt?.getTime()
                            ) {
                                return false;
                            }

                            const updated = await tx.staffRecoveryCode.updateMany({
                                where: {
                                    id: recovery.id,
                                    userId: user.id,
                                    usedAt: null,
                                },
                                data: { usedAt: new Date() },
                            });
                            if (updated.count !== 1) return false;

                            await tx.auditLog.create({
                                data: {
                                    action: 'STAFF_RECOVERY_CODE_USED',
                                    actorUserId: user.id,
                                    targetUserId: user.id,
                                    meta: { recoveryCodeId: recovery.id },
                                },
                            });
                            return true;
                        });
                        if (!consumed) return null;
                    } else {
                        if (!user.staffTotpSecretEncrypted || !totpCode) return null;

                        const secret = decryptTotpSecret(user.staffTotpSecretEncrypted);
                        const step = verifyTotpCode(secret, totpCode);
                        if (step === null) return null;

                        const consumed = await prisma.user.updateMany({
                            where: {
                                id: user.id,
                                role: { in: [Role.ADMIN, Role.MODERATOR] },
                                staffTotpEnabledAt: user.staffTotpEnabledAt,
                                staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
                                OR: [
                                    { staffTotpLastUsedStep: null },
                                    { staffTotpLastUsedStep: { lt: step } },
                                ],
                            },
                            data: { staffTotpLastUsedStep: step },
                        });
                        if (consumed.count !== 1) return null;
                    }
                }

                const [finalModerationState, finalSecurity] = await Promise.all([
                    getNormalizedAccountModerationState(user.id),
                    prisma.user.findUnique({
                        where: { id: user.id },
                        select: {
                            staffTotpEnabledAt: true,
                            staffTotpSecretEncrypted: true,
                        },
                    }),
                ]);
                if (
                    !finalModerationState ||
                    !finalSecurity ||
                    finalModerationState.status === AccountStatus.SUSPENDED
                ) {
                    return null;
                }

                const finalIsStaff =
                    finalModerationState.role === Role.ADMIN ||
                    finalModerationState.role === Role.MODERATOR;
                if (finalIsStaff && !isStaff) return null;
                if (
                    finalIsStaff &&
                    finalSecurity.staffTotpEnabledAt?.getTime() !==
                        user.staffTotpEnabledAt?.getTime()
                ) {
                    return null;
                }
                if (
                    finalIsStaff &&
                    user.staffTotpEnabledAt &&
                    finalSecurity.staffTotpSecretEncrypted !==
                        user.staffTotpSecretEncrypted
                ) {
                    return null;
                }

                return {
                    ...user,
                    role: finalModerationState.role,
                    status: finalModerationState.status,
                    suspendedUntil: finalModerationState.suspendedUntil,
                    restrictionUntil: finalModerationState.restrictionUntil,
                    restrictionReason: finalModerationState.restrictionReason,
                    sessionVersion: finalModerationState.sessionVersion,
                };
            },
        }),
    ],
});

export const handlers = nextAuthResult.handlers;
export const auth = nextAuthResult.auth;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
