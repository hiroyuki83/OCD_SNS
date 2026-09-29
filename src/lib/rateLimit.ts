import 'server-only';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logOperationalError } from '@/lib/operationalError';
import {
    RATE_LIMIT_CLEANUP_SAMPLE_SIZE,
    shouldCleanupExpiredRateLimitBuckets,
} from '@/lib/rateLimitCleanupCore';

type RateLimitResult = { count: number };

async function maybeCleanupExpiredBuckets() {
    const sample = crypto.randomInt(RATE_LIMIT_CLEANUP_SAMPLE_SIZE);
    if (!shouldCleanupExpiredRateLimitBuckets(sample)) return;

    try {
        await prisma.rateLimitBucket.deleteMany({
            where: { resetAt: { lte: new Date() } },
        });
    } catch (error) {
        logOperationalError('RATE_LIMIT_CLEANUP_FAILED', error);
    }
}

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

        await maybeCleanupExpiredBuckets();
        return (rows[0]?.count ?? limit + 1) <= limit;
    } catch (error) {
        logOperationalError('RATE_LIMIT_CHECK_FAILED', error);
        return false;
    }
}
