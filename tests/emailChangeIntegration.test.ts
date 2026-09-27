import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const verification = readFileSync(
  join(process.cwd(), 'src', 'app', 'verify-email', 'actions.ts'),
  'utf8',
);
const delivery = readFileSync(
  join(process.cwd(), 'src', 'lib', 'emailVerification.ts'),
  'utf8',
);
const schema = readFileSync(
  join(process.cwd(), 'prisma', 'schema.prisma'),
  'utf8',
);

test('email change tokens carry a pending email address', () => {
  assert.match(delivery, /pendingEmail/);
  assert.match(delivery, /sendEmailChangeVerification/);
});

test('confirming an email change revokes existing sessions', () => {
  assert.match(verification, /const pendingEmail = record\.pendingEmail/);
  assert.match(verification, /email: pendingEmail/);
  assert.match(verification, /sessionVersion: \{ increment: 1 \}/);
  assert.match(verification, /action: 'EMAIL_CHANGED'/);
});

test('normal registration verification remains distinct from email change', () => {
  assert.match(verification, /pendingEmail: null/);
  assert.match(verification, /action: 'EMAIL_VERIFY'/);
});


test('pending email belongs only to email verification tokens', () => {
  const passwordResetBlock = schema.match(/model PasswordResetToken \{[\s\S]*?\n\}/)?.[0] ?? '';
  const emailVerificationBlock = schema.match(/model EmailVerificationToken \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(passwordResetBlock, /pendingEmail/);
  assert.match(emailVerificationBlock, /pendingEmail\s+String\?/);
});
