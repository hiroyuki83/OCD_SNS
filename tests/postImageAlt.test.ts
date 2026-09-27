import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeImageAlt } from '../src/lib/postImageAlt';

test('normalizes whitespace in image alt text', () => {
  assert.deepEqual(normalizeImageAlt('  青い空\nと 海  '), {
    ok: true,
    value: '青い空 と 海',
  });
});

test('treats empty alt text as null', () => {
  assert.deepEqual(normalizeImageAlt('   '), { ok: true, value: null });
});

test('allows 300 Unicode characters', () => {
  const value = 'あ'.repeat(300);
  assert.deepEqual(normalizeImageAlt(value), { ok: true, value });
});

test('rejects image alt text over 300 characters', () => {
  const result = normalizeImageAlt('あ'.repeat(301));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, '画像の説明は300文字以内です。');
});
