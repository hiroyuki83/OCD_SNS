import 'server-only';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

type RateLimitResult = { count: number };

export async function rateLimit(key: string, limit: number, windowMs: number) {
    if (!key || limit < 1 || windowMs < 1) return false;

    const storedKey = crypto.createHash('sha256').update(key).digest('hex');
    const resetAt = new Date(Date.now() + windowMs);

    try {
        const rows = await prisma.$queryRaw<RateLimitResult[]>`
            INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
            VALUES (${storedKey}, 1, ${resetAt}, CURRENT_TIMESTAMP)
            ON CONFLICT ("key") DO UPDATE SET
                "count" = CASE
                    WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN 1
                    ELSE "RateLimitBucket"."count" + 1
                END,
                "resetAt" = CASE
                    WHEN "RateLimitBucket"."resetAt" <= CURRENT_TIMESTAMP THEN EXCLUDED."resetAt"
                    ELSE "RateLimitBucket"."resetAt"
                END,
                "updatedAt" = CURRENT_TIMESTAMP
            RETURNING "count"
        `;

        return (rows[0]?.count ?? limit + 1) <= limit;
    } catch (error) {
        console.error('Rate limit check failed:', error);
        return false;
    }
}
