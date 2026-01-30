import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'behavior.cognition@gmail.com').toLowerCase();
const MODERATOR_EMAILS = (process.env.MODERATOR_EMAILS ?? process.env.MODERATOR_EMAIL ?? '')
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

async function getUser(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        return user;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}

async function bootstrapRole(user: { id: string; email: string; role: Role }) {
    const normalizedEmail = user.email.toLowerCase();
    if (user.role !== Role.USER) return user;
    if (normalizedEmail === ADMIN_EMAIL) {
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
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) {
                        const updatedUser = await bootstrapRole({
                            id: user.id,
                            email: user.email,
                            role: user.role as Role,
                        });
                        return updatedUser;
                    }
                }

                console.log('Invalid credentials');
                return null;
            },
        }),
    ],
});

export const handlers = nextAuthResult.handlers;
export const auth = nextAuthResult.auth;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
