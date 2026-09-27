import test from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, jstDateKey, stableShuffle } from '../src/lib/stableShuffle';

test('stableShuffle is deterministic for the same seed', () => {
  const input = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(stableShuffle(input, 'same'), stableShuffle(input, 'same'));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
});

test('stableShuffle preserves every item exactly once', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const shuffled = stableShuffle(input, 'seed');
  assert.deepEqual([...shuffled].sort(), [...input].sort());
});

test('hashSeed changes for distinct seed strings', () => {
  assert.notEqual(hashSeed('viewer-a'), hashSeed('viewer-b'));
});

test('jstDateKey uses the Tokyo calendar day', () => {
  assert.equal(jstDateKey(new Date('2026-09-26T15:30:00.000Z')), '2026-09-27');
  assert.equal(jstDateKey(new Date('2026-09-27T14:59:59.000Z')), '2026-09-27');
  assert.equal(jstDateKey(new Date('2026-09-27T15:00:00.000Z')), '2026-09-28');
});
