import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUniqueStringIds } from '../src/lib/idList';

test('parseUniqueStringIds accepts trimmed unique ids', () => {
  assert.deepEqual(parseUniqueStringIds([' a ', 'b'], 5), {
    ok: true,
    value: ['a', 'b'],
  });
});

test('parseUniqueStringIds rejects non-arrays and invalid entries', () => {
  assert.deepEqual(parseUniqueStringIds(null, 5), { ok: false });
  assert.deepEqual(parseUniqueStringIds(['a', 1], 5), { ok: false });
  assert.deepEqual(parseUniqueStringIds([''], 5), { ok: false });
});

test('parseUniqueStringIds rejects duplicates and oversized input', () => {
  assert.deepEqual(parseUniqueStringIds(['a', 'a'], 5), { ok: false });
  assert.deepEqual(parseUniqueStringIds(['a', 'b'], 1), { ok: false });
  assert.deepEqual(parseUniqueStringIds(['abcd'], 5, 3), { ok: false });
});
