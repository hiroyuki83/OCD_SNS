import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPage, parsePageNumber } from '../src/lib/pagination';

test('parsePageNumber accepts positive safe integers only', () => {
  assert.equal(parsePageNumber('1'), 1);
  assert.equal(parsePageNumber('42'), 42);
  assert.equal(parsePageNumber('0'), 1);
  assert.equal(parsePageNumber('-1'), 1);
  assert.equal(parsePageNumber('1.5'), 1);
  assert.equal(parsePageNumber('abc'), 1);
  assert.equal(parsePageNumber(' 2 '), 1);
  assert.equal(parsePageNumber('999999999999999999999999'), 1);
  assert.equal(parsePageNumber(undefined), 1);
});

test('clampPage calculates a bounded page window', () => {
  assert.deepEqual(clampPage(2, 95, 50), {
    page: 2,
    pageSize: 50,
    totalPages: 2,
    skip: 50,
    hasPrevious: true,
    hasNext: false,
  });
});

test('clampPage clamps oversized pages and empty results', () => {
  assert.equal(clampPage(99, 101, 50).page, 3);
  assert.deepEqual(clampPage(5, 0, 50), {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    skip: 0,
    hasPrevious: false,
    hasNext: false,
  });
});
