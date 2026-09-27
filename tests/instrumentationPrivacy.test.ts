import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'src', 'instrumentation.ts'),
  'utf8',
);

test('server instrumentation reports request errors through privacy-safe logger', () => {
  assert.match(source, /onRequestError/);
  assert.match(source, /logOperationalError/);
});

test('server instrumentation does not log raw request paths, headers, or messages', () => {
  assert.doesNotMatch(source, /request\.path/);
  assert.doesNotMatch(source, /request\.headers/);
  assert.doesNotMatch(source, /error\.message/);
  assert.doesNotMatch(source, /error\.stack/);
});
