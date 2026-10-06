import type { NextAuthConfig } from 'next-auth';

const protectedPrefixes = [
    '/',
    '/user',
    '/post',
    '/explore',
    '/admin',
    '/moderation',
    '/bookmarks',
    '/notifications',
    '/profile',
    '/settings',
    '/test',
];

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    providers: [
        // Added later in auth.ts
    ],
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const pathname = nextUrl.pathname;

            if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
                if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
                return true;
            }

            const requiresLogin = protectedPrefixes.some(
                (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
            );

            if (requiresLogin && !isLoggedIn) {
                return false;
            }

            return true;
        },
    },
} satisfies NextAuthConfig;
