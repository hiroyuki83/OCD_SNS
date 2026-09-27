import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_JSON_MUTATION_BYTES,
  parseJsonText,
  utf8ByteLength,
  validateContentLength,
} from '../src/lib/requestPayload';

test('accepts absent and numeric Content-Length values', () => {
  assert.deepEqual(validateContentLength(null), { ok: true });
  assert.deepEqual(validateContentLength('0'), { ok: true });
  assert.deepEqual(validateContentLength('123'), { ok: true });
});

test('rejects malformed Content-Length values', () => {
  for (const value of ['-1', '1.5', 'abc', ' 12 ']) {
    const result = validateContentLength(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 400);
  }
});

test('rejects a declared JSON body above the mutation limit', () => {
  const result = validateContentLength(String(MAX_JSON_MUTATION_BYTES + 1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test('counts UTF-8 bytes rather than JavaScript code units', () => {
  assert.equal(utf8ByteLength('あ'), 3);
  assert.equal(utf8ByteLength('abc'), 3);
});

test('parses a valid JSON body', () => {
  const result = parseJsonText<{ ok: boolean }>('{"ok":true}');
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.ok, true);
});

test('rejects empty, malformed, and actually oversized JSON bodies', () => {
  const empty = parseJsonText('   ');
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.status, 400);

  const malformed = parseJsonText('{');
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.status, 400);

  const oversized = parseJsonText('"あ"', 4);
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.status, 413);
});
