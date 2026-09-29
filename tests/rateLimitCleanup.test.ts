import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RATE_LIMIT_CLEANUP_SAMPLE_SIZE,
  shouldCleanupExpiredRateLimitBuckets,
} from '../src/lib/rateLimitCleanupCore';

test('rate-limit cleanup sampling is independent of process-local request count', () => {
  assert.equal(RATE_LIMIT_CLEANUP_SAMPLE_SIZE, 100);
  assert.equal(shouldCleanupExpiredRateLimitBuckets(0), true);

  for (const sample of [1, 2, 50, 99]) {
    assert.equal(shouldCleanupExpiredRateLimitBuckets(sample), false);
  }
});

test('rate-limit cleanup sampler rejects invalid samples', () => {
  for (const sample of [-1, 100, 101, Number.NaN, 1.5]) {
    assert.equal(shouldCleanupExpiredRateLimitBuckets(sample), false);
  }
});
