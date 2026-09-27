import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEmailChangeInput } from '../src/lib/emailChangeInput';

test('normalizes a valid new email address', () => {
  assert.deepEqual(parseEmailChangeInput('password123', ' New.User@Example.COM '), {
    ok: true,
    currentPassword: 'password123',
    newEmail: 'new.user@example.com',
  });
});

test('rejects invalid email addresses', () => {
  assert.equal(parseEmailChangeInput('password123', 'not-an-email').ok, false);
});

test('rejects missing current password', () => {
  assert.equal(parseEmailChangeInput('', 'new@example.com').ok, false);
});
