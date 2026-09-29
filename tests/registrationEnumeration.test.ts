import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/app/lib/actions.ts', 'utf8');

test('registration does not expose whether an email is already registered', () => {
  assert.doesNotMatch(source, /このメールアドレスは既に使用されています/);
  assert.match(source, /genericRegistrationMessage/);
  assert.match(
    source,
    /登録可能なメールアドレスであれば、確認メールを送信しました/,
  );
});

test('verified and unverified existing accounts share the generic registration response', () => {
  assert.match(source, /select: \{ id: true, email: true, emailVerifiedAt: true \}/);
  assert.match(source, /if \(existingUser\)/);
  assert.match(source, /if \(!existingUser\.emailVerifiedAt\)/);
  assert.match(source, /return \{ ok: true, message: genericRegistrationMessage \}/);
});

test('registration email delivery failures do not create a distinct user-visible response', () => {
  const catchIndex = source.indexOf("logOperationalError('REGISTRATION_VERIFICATION_EMAIL_FAILED'");
  const genericReturnIndex = source.indexOf('return { ok: true, message: genericRegistrationMessage }');

  assert.ok(catchIndex >= 0);
  assert.ok(genericReturnIndex > catchIndex);
});
