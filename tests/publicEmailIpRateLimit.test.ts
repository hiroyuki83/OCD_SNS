import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const helper = readFileSync('src/lib/publicEmailRateLimit.ts', 'utf8');
const actions = readFileSync('src/app/lib/actions.ts', 'utf8');
const passwordReset = readFileSync('src/app/password-reset/actions.ts', 'utf8');
const verifyEmail = readFileSync('src/app/verify-email/actions.ts', 'utf8');

test('public email requests share one hashed-IP rate-limit bucket', () => {
  assert.match(helper, /currentRequestClientIp\(\)/);
  assert.match(helper, /PUBLIC_EMAIL_IP_LIMIT = 20/);
  assert.match(helper, /PUBLIC_EMAIL_IP_WINDOW_MS = 60 \* 60 \* 1000/);
  assert.match(helper, /public-email-ip:/);
  assert.match(helper, /rateLimit\(/);
});

test('registration checks the shared IP bucket before the per-email bucket', () => {
  const ipIndex = actions.indexOf('await allowPublicEmailRequestFromCurrentIp()');
  const emailIndex = actions.indexOf('rateLimit(`register:${normalizedEmail}`');

  assert.ok(ipIndex >= 0);
  assert.ok(emailIndex > ipIndex);
});

test('password reset keeps a generic response when the shared IP bucket is exhausted', () => {
  assert.match(
    passwordReset,
    /allowPublicEmailRequestFromCurrentIp\(\)[\s\S]{0,180}genericRequestMessage/,
  );
  assert.match(passwordReset, /rateLimit\(`password-reset:\$\{email\}`/);
});

test('verification resend keeps a generic response when the shared IP bucket is exhausted', () => {
  assert.match(
    verifyEmail,
    /allowPublicEmailRequestFromCurrentIp\(\)[\s\S]{0,180}genericMessage/,
  );
  assert.match(verifyEmail, /rateLimit\(`email-verification:\$\{parsed\.data\}`/);
});
