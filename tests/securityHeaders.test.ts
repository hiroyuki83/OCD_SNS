import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nextConfig = readFileSync('next.config.ts', 'utf8');

test('global security headers remain enabled', () => {
  for (const required of [
    'X-Content-Type-Options',
    'nosniff',
    'X-Frame-Options',
    'DENY',
    'Strict-Transport-Security',
    'Cross-Origin-Opener-Policy',
    'Cross-Origin-Resource-Policy',
    'Permissions-Policy',
    'Content-Security-Policy',
  ]) {
    assert.equal(nextConfig.includes(required), true, required);
  }
});

test('referrer policy does not leak sensitive route paths cross-origin', () => {
  assert.equal(nextConfig.includes('Referrer-Policy\", value: \"no-referrer'), true);
  assert.equal(nextConfig.includes('strict-origin-when-cross-origin'), false);
});

test('CSP blocks framing, plugins, foreign form targets, and inline script attributes', () => {
  for (const directive of [
    \"object-src 'none'\",
    \"frame-src 'none'\",
    \"frame-ancestors 'none'\",
    \"form-action 'self'\",
    \"base-uri 'self'\",
    \"script-src-attr 'none'\",
  ]) {
    assert.equal(nextConfig.includes(directive), true, directive);
  }
});

test('cross-origin resource policy stays same-origin', () => {
  assert.equal(
    nextConfig.includes('Cross-Origin-Resource-Policy\", value: \"same-origin'),
    true,
  );
});
