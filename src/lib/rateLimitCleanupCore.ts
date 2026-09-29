export const RATE_LIMIT_CLEANUP_SAMPLE_SIZE = 100;

export function shouldCleanupExpiredRateLimitBuckets(sample: number) {
  return (
    Number.isSafeInteger(sample) &&
    sample >= 0 &&
    sample < RATE_LIMIT_CLEANUP_SAMPLE_SIZE &&
    sample === 0
  );
}
