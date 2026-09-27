import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAccountDeletionInput } from '../src/lib/accountDeletionInput';

test('accepts a password and exact deletion confirmation phrase', () => {
  assert.deepEqual(parseAccountDeletionInput('password123', '削除する'), {
    ok: true,
    currentPassword: 'password123',
  });
});

test('rejects an incorrect deletion confirmation phrase', () => {
  const result = parseAccountDeletionInput('password123', '削除');
  assert.equal(result.ok, false);
});

test('rejects missing or oversized current passwords', () => {
  assert.equal(parseAccountDeletionInput('', '削除する').ok, false);
  assert.equal(parseAccountDeletionInput('a'.repeat(129), '削除する').ok, false);
});
