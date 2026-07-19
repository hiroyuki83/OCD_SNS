import type { NextAuthConfig } from 'next-auth';

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
            // Allow access to login and register pages
            if (nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register')) {
                if (isLoggedIn) return Response.redirect(new URL('/', nextUrl)); // Redirect to home if already logged in
                return true;
            }

            // Logic to protect generic routes if needed
            // For X clone, maybe allow viewing feed but not posting?
            // For now, let's just allow everything and handle protection in components or specific actions
            return true;
        },
    },
} satisfies NextAuthConfig;
