import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  verifyTotpCode,
} from '../src/lib/totp';

const RFC_SECRET_BASE32 = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('RFC 6238 SHA1 vector at 59 seconds', () => {
  assert.equal(generateTotpCode(RFC_SECRET_BASE32, 1, 8), '94287082');
});

test('verifies a six digit TOTP in the current step', () => {
  const now = 59_000;
  const code = generateTotpCode(RFC_SECRET_BASE32, 1, 6);
  assert.equal(code, '287082');
  assert.equal(verifyTotpCode(RFC_SECRET_BASE32, code, { now, window: 0 }), 1);
});

test('encrypts and decrypts a TOTP secret', () => {
  process.env.STAFF_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const encrypted = encryptTotpSecret(RFC_SECRET_BASE32);
  assert.notEqual(encrypted, RFC_SECRET_BASE32);
  assert.equal(decryptTotpSecret(encrypted), RFC_SECRET_BASE32);
});
