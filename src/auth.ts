import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { AccountStatus, Role } from '@prisma/client';
import { decryptTotpSecret, verifyTotpCode } from '@/lib/totp';

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

type AuthUserForRoleBootstrap = {
    id: string;
    email: string;
    role: Role;
    staffTotpEnabledAt: Date | null;
    staffTotpSecretEncrypted: string | null;
    staffTotpLastUsedStep: number | null;
};

async function bootstrapRole(user: AuthUserForRoleBootstrap) {
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

                const roleValue = (user as { role?: Role }).role;
                if (roleValue) {
                    token.role = roleValue;
                }

                token.staffMfaVerified =
                    (user as { staffMfaVerified?: boolean }).staffMfaVerified === true;
                return token;
            }

            const tokenUserId = (token.id ?? token.sub) as string | undefined;
            if (!tokenUserId) return null;

            const currentUser = await prisma.user.findUnique({
                where: { id: tokenUserId },
                select: {
                    role: true,
                    staffTotpEnabledAt: true,
                },
            });
            if (!currentUser) return null;

            token.role = currentUser.role;
            const isStaff =
                currentUser.role === Role.ADMIN || currentUser.role === Role.MODERATOR;

            if (isStaff && currentUser.staffTotpEnabledAt && token.staffMfaVerified !== true) {
                return null;
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
            if (session.user) {
                session.user.staffMfaVerified = token?.staffMfaVerified === true;
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
                    })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password, totpCode } = parsedCredentials.data;
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
                    if (passwordsMatch) {
                        const updatedUser = await bootstrapRole({
                            id: user.id,
                            email: user.email,
                            role: user.role as Role,
                            staffTotpEnabledAt: user.staffTotpEnabledAt,
                            staffTotpSecretEncrypted: user.staffTotpSecretEncrypted,
                            staffTotpLastUsedStep: user.staffTotpLastUsedStep,
                        });

                        const isStaff =
                            updatedUser.role === Role.ADMIN || updatedUser.role === Role.MODERATOR;

                        if (isStaff && updatedUser.staffTotpEnabledAt) {
                            if (
                                !(await rateLimit(
                                    `login-mfa:${updatedUser.id}`,
                                    10,
                                    15 * 60 * 1000,
                                ))
                            ) {
                                return null;
                            }

                            if (!updatedUser.staffTotpSecretEncrypted || !totpCode) {
                                return null;
                            }

                            const secret = decryptTotpSecret(updatedUser.staffTotpSecretEncrypted);
                            const step = verifyTotpCode(secret, totpCode, { window: 1 });
                            if (step === null) return null;

                            const replayGuard = await prisma.user.updateMany({
                                where: {
                                    id: updatedUser.id,
                                    OR: [
                                        { staffTotpLastUsedStep: null },
                                        { staffTotpLastUsedStep: { lt: step } },
                                    ],
                                },
                                data: { staffTotpLastUsedStep: step },
                            });
                            if (replayGuard.count !== 1) return null;

                            return { ...updatedUser, staffMfaVerified: true };
                        }

                        return { ...updatedUser, staffMfaVerified: false };
                    }
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
