import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchQuery } from '../src/lib/searchInput';

test('normalizes whitespace and control characters in search queries', () => {
  assert.deepEqual(normalizeSearchQuery('  OCD\n\t ERP\u0000  '), {
    ok: true,
    value: 'OCD ERP',
  });
});

test('allows an empty normalized search query', () => {
  assert.deepEqual(normalizeSearchQuery(' \n\t '), {
    ok: true,
    value: '',
  });
});

test('accepts a 100 character search query', () => {
  const value = 'あ'.repeat(100);
  assert.deepEqual(normalizeSearchQuery(value), {
    ok: true,
    value,
  });
});

test('rejects a search query longer than 100 Unicode characters', () => {
  const result = normalizeSearchQuery('あ'.repeat(101));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, '検索語は100文字以内です。');
});


test('preserves hashtag and handle prefixes for search routing', () => {
  assert.deepEqual(normalizeSearchQuery('  #OCD  '), {
    ok: true,
    value: '#OCD',
  });
  assert.deepEqual(normalizeSearchQuery('  @coco  '), {
    ok: true,
    value: '@coco',
  });
});
