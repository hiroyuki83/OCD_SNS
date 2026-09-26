import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { AccountStatus, Role } from '@prisma/client';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';
import { hashRecoveryCode } from '@/lib/recoveryCodes';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? '').toLowerCase();
const MODERATOR_EMAILS = (process.env.MODERATOR_EMAILS ?? process.env.MODERATOR_EMAIL ?? '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

async function getUser(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

async function bootstrapRole(user: { id: string; email: string; role: Role }) {
    const normalizedEmail = user.email.toLowerCase();
    if (user.role !== Role.USER) return user;
    if (ADMIN_EMAIL && normalizedEmail === ADMIN_EMAIL) {
        return prisma.user.update({
            where: { id: user.id },
            data: { role: Role.ADMIN },
        });
    }
    if (MODERATOR_EMAILS.includes(normalizedEmail)) {
        return prisma.user.update({
            where: { id: user.id },
            data: { role: Role.MODERATOR },
        });
    }
    return user;
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
            }
            const roleValue = (user as { role?: Role } | undefined)?.role;
            if (roleValue) {
                token.role = roleValue;
            }
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
                        email: z.string().trim().toLowerCase().email(),
                        password: z.string().min(6).max(128),
                        totpCode: z.string().trim().optional(),
                        recoveryCode: z.string().trim().max(64).optional(),
                    })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password, totpCode, recoveryCode } = parsedCredentials.data;
                    if (!(await rateLimit(`login:${email}`, 10, 15 * 60 * 1000))) {
                        return null;
                    }
                    const user = await getUser(email);
                    if (!user) return null;
                    if (!user.emailVerifiedAt) return null;

                    if (user.status === AccountStatus.SUSPENDED) {
                        if (!user.suspendedUntil || user.suspendedUntil > new Date()) {
                            return null;
                        }
                        await prisma.user.update({
                            where: { id: user.id },
                            data: {
                                status: AccountStatus.ACTIVE,
                                suspendedUntil: null,
                                restrictionReason: null,
                            },
                        });
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (!passwordsMatch) return null;

                    const isStaff = user.role === Role.ADMIN || user.role === Role.MODERATOR;
                    if (isStaff && user.staffTotpEnabledAt) {
                        if (!(await rateLimit(`staff-mfa-login:${user.id}`, 10, 15 * 60 * 1000))) {
                            return null;
                        }

                        if (recoveryCode) {
                            const codeHash = hashRecoveryCode(recoveryCode);
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
                                const updated = await tx.staffRecoveryCode.updateMany({
                                    where: {
                                        id: recovery.id,
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

                    const updatedUser = await bootstrapRole({
                        id: user.id,
                        email: user.email,
                        role: user.role as Role,
                    });
                    return updatedUser;
                }

                return null;
            },
        }),
    ],
});

export const handlers = nextAuthResult.handlers;
export const auth = nextAuthResult.auth;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
