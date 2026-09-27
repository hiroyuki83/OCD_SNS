import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBoundedInteger,
  parseBoundedStringList,
  parseItqTiming,
} from '../src/lib/selfTestInput';

test('parseBoundedInteger accepts only whole decimal strings in range', () => {
  assert.equal(parseBoundedInteger('3', 0, 4), 3);
  assert.equal(parseBoundedInteger('3abc', 0, 4), null);
  assert.equal(parseBoundedInteger('3.0', 0, 4), null);
  assert.equal(parseBoundedInteger('-1', 0, 4), null);
  assert.equal(parseBoundedInteger('5', 0, 4), null);
});

test('parseBoundedStringList bounds count, strips controls, and rejects oversized items', () => {
  assert.deepEqual(parseBoundedStringList(['  wash\u0000 ', 'check'], 3, 10), ['wash', 'check']);
  assert.equal(parseBoundedStringList(['a', 'b'], 1, 10), null);
  assert.equal(parseBoundedStringList(['toolong'], 3, 3), null);
  assert.equal(parseBoundedStringList(['   '], 3, 10), null);
});

test('parseItqTiming accepts only supported timing codes', () => {
  assert.equal(parseItqTiming('a'), 'a');
  assert.equal(parseItqTiming('f'), 'f');
  assert.equal(parseItqTiming('g'), null);
  assert.equal(parseItqTiming('a<script>'), null);
});
