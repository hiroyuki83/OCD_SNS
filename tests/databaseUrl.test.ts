import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePostgresSslMode } from '../src/lib/databaseUrl';

test('upgrades pg SSL alias modes to explicit verify-full', () => {
  for (const mode of ['require', 'prefer', 'verify-ca']) {
    const result = normalizePostgresSslMode(
      `postgresql://user:pass@example.com/neondb?sslmode=${mode}&channel_binding=require`,
    );
    const url = new URL(result);
    assert.equal(url.searchParams.get('sslmode'), 'verify-full');
    assert.equal(url.searchParams.get('channel_binding'), 'require');
  }
});

test('keeps explicit verify-full unchanged', () => {
  const input = 'postgresql://user:pass@example.com/neondb?sslmode=verify-full';
  assert.equal(normalizePostgresSslMode(input), input);
});

test('does not alter non-PostgreSQL or invalid strings', () => {
  assert.equal(normalizePostgresSslMode('https://example.com'), 'https://example.com');
  assert.equal(normalizePostgresSslMode('not-a-url'), 'not-a-url');
  assert.equal(normalizePostgresSslMode(undefined), '');
});
