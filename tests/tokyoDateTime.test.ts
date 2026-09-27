import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTokyoDateTimeLocal, parseTokyoDateTimeLocal } from '../src/lib/tokyoDateTime';

test('datetime-local is interpreted as Japan Standard Time', () => {
  assert.equal(
    parseTokyoDateTimeLocal('2026-09-27T18:30')?.toISOString(),
    '2026-09-27T09:30:00.000Z',
  );
});

test('invalid calendar dates and malformed values are rejected', () => {
  assert.equal(parseTokyoDateTimeLocal('2026-02-30T12:00'), null);
  assert.equal(parseTokyoDateTimeLocal('2026-13-01T12:00'), null);
  assert.equal(parseTokyoDateTimeLocal('2026-09-27 12:00'), null);
  assert.equal(parseTokyoDateTimeLocal(''), null);
});


test('Date values are formatted as Tokyo datetime-local values', () => {
  assert.equal(
    formatTokyoDateTimeLocal(new Date('2026-09-27T09:30:00.000Z')),
    '2026-09-27T18:30',
  );
  assert.equal(
    formatTokyoDateTimeLocal(new Date('2026-09-27T15:15:00.000Z')),
    '2026-09-28T00:15',
  );
  assert.equal(formatTokyoDateTimeLocal(null), '');
});
