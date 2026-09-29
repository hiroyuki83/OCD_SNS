import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('auth token cleanup removes only expired password reset and email verification tokens', () => {
  const source = readFileSync('src/lib/authTokenCleanup.ts', 'utf8');

  assert.match(source, /passwordResetToken\.deleteMany/);
  assert.match(source, /emailVerificationToken\.deleteMany/);
  assert.match(source, /expiresAt:\s*\{\s*lte:\s*now\s*\}/);
  assert.match(source, /AUTH_TOKEN_CLEANUP_FAILED/);
  assert.doesNotMatch(source, /usedAt:\s*null/);
  assert.doesNotMatch(source, /deleteMany\(\{\s*\}\)/);
});

test('token issuance paths perform best-effort expired-token cleanup', () => {
  const verification = readFileSync('src/lib/emailVerification.ts', 'utf8');
  const reset = readFileSync('src/app/password-reset/actions.ts', 'utf8');

  assert.match(verification, /cleanupExpiredAuthTokens\(invalidatedAt\)/);
  assert.match(reset, /cleanupExpiredAuthTokens\(issuedAt\)/);
});
