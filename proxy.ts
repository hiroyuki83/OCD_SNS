import NextAuth from 'next-auth';
import { authConfig } from './src/auth.config';

export default NextAuth(authConfig).auth;

export const config = {
    matcher: [
        '/admin/:path*',
        '/moderation/:path*',
        '/bookmarks/:path*',
        '/notifications/:path*',
        '/profile/:path*',
        '/settings/:path*',
        '/test/:path*',
    ],
};
