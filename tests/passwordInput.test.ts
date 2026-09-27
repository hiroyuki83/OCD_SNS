import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePasswordChangeInput } from '../src/lib/passwordInput';

test('accepts a valid password change', () => {
  assert.deepEqual(
    parsePasswordChangeInput('old-password-1', 'new-password-2', 'new-password-2'),
    {
      ok: true,
      currentPassword: 'old-password-1',
      newPassword: 'new-password-2',
    },
  );
});

test('requires the current password', () => {
  assert.deepEqual(parsePasswordChangeInput('', 'new-password-2', 'new-password-2'), {
    ok: false,
    message: '現在のパスワードを入力してください。',
  });
});

test('requires at least 10 characters for the new password', () => {
  assert.equal(
    parsePasswordChangeInput('old-password-1', 'short', 'short').ok,
    false,
  );
});

test('rejects passwords longer than 128 characters', () => {
  const password = 'a'.repeat(129);
  assert.equal(
    parsePasswordChangeInput('old-password-1', password, password).ok,
    false,
  );
});

test('rejects whitespace-only passwords', () => {
  const password = ' '.repeat(10);
  assert.equal(
    parsePasswordChangeInput('old-password-1', password, password).ok,
    false,
  );
});

test('requires matching confirmation', () => {
  assert.equal(
    parsePasswordChangeInput('old-password-1', 'new-password-2', 'new-password-3').ok,
    false,
  );
});

test('rejects reusing the current password', () => {
  assert.equal(
    parsePasswordChangeInput('same-password', 'same-password', 'same-password').ok,
    false,
  );
});
