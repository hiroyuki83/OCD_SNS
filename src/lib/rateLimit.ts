type RateLimitEntry = {
    count: number;
    resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
    __cocoRateLimit?: Map<string, RateLimitEntry>;
};

const buckets = globalForRateLimit.__cocoRateLimit ?? new Map<string, RateLimitEntry>();

if (process.env.NODE_ENV !== 'production') {
    globalForRateLimit.__cocoRateLimit = buckets;
}

export function rateLimit(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (current.count >= limit) {
        return false;
    }

    current.count += 1;
    return true;
}
