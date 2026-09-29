import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTrustedAppOrigin } from '../src/lib/appOriginCore';

test('prefers NEXTAUTH_URL and normalizes the trailing slash', () => {
  assert.equal(
    resolveTrustedAppOrigin({
      NEXTAUTH_URL: 'https://coco.example.com/',
      AUTH_URL: 'https://ignored.example.com',
      NODE_ENV: 'production',
    }),
    'https://coco.example.com',
  );
});

test('falls back to AUTH_URL when NEXTAUTH_URL is absent', () => {
  assert.equal(
    resolveTrustedAppOrigin({
      AUTH_URL: 'https://auth.example.com',
      NODE_ENV: 'production',
    }),
    'https://auth.example.com',
  );
});

test('uses the Vercel production hostname before the deployment hostname', () => {
  assert.equal(
    resolveTrustedAppOrigin({
      VERCEL_PROJECT_PRODUCTION_URL: 'coco.example.vercel.app',
      VERCEL_URL: 'preview.example.vercel.app',
      NODE_ENV: 'production',
    }),
    'https://coco.example.vercel.app',
  );
});

test('allows loopback HTTP only outside Production or in isolated E2E email mode', () => {
  assert.equal(
    resolveTrustedAppOrigin({
      NEXTAUTH_URL: 'http://127.0.0.1:3000',
      NODE_ENV: 'test',
    }),
    'http://127.0.0.1:3000',
  );

  assert.equal(
    resolveTrustedAppOrigin({
      NEXTAUTH_URL: 'http://127.0.0.1:3000',
      NODE_ENV: 'production',
      E2E_EMAIL_MODE: '1',
    }),
    'http://127.0.0.1:3000',
  );

  assert.throws(() =>
    resolveTrustedAppOrigin({
      NEXTAUTH_URL: 'http://127.0.0.1:3000',
      NODE_ENV: 'production',
    }),
  );
});

test('rejects credentials, paths, query strings, fragments, and non-HTTP schemes', () => {
  for (const value of [
    'https://user:pass@example.com',
    'https://example.com/reset',
    'https://example.com?next=/reset',
    'https://example.com#fragment',
    'javascript:alert(1)',
    'ftp://example.com',
  ]) {
    assert.throws(() =>
      resolveTrustedAppOrigin({
        NEXTAUTH_URL: value,
        NODE_ENV: 'production',
      }),
    );
  }
});

test('Production does not silently fall back to localhost', () => {
  assert.throws(
    () => resolveTrustedAppOrigin({ NODE_ENV: 'production' }),
    /Trusted application origin is not configured/,
  );
});

test('development without an origin keeps the localhost fallback', () => {
  assert.equal(
    resolveTrustedAppOrigin({ NODE_ENV: 'development' }),
    'http://localhost:3000',
  );
});
