import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePreviewSeedSafety } from '../src/lib/previewSafety';

const valid = {
  vercelEnv: 'preview',
  gitRef: 'security-integration-final-20260926',
  seedUsers: '1',
  databaseUrl: 'postgresql://preview-db',
  previewDatabaseUrl: 'postgresql://preview-db',
  testPassword: 'preview-password',
};

test('accepts an explicitly isolated Preview seed configuration', () => {
  assert.equal(validatePreviewSeedSafety(valid).ok, true);
});

test('rejects Preview seeding outside Vercel Preview', () => {
  const result = validatePreviewSeedSafety({ ...valid, vercelEnv: 'production' });
  assert.equal(result.ok, false);
});

test('rejects Preview seeding on another branch', () => {
  const result = validatePreviewSeedSafety({ ...valid, gitRef: 'main' });
  assert.equal(result.ok, false);
});

test('requires the explicit seed opt-in', () => {
  const result = validatePreviewSeedSafety({ ...valid, seedUsers: '0' });
  assert.equal(result.ok, false);
});

test('requires DATABASE_URL and PREVIEW_DATABASE_URL to match exactly', () => {
  const result = validatePreviewSeedSafety({
    ...valid,
    databaseUrl: 'postgresql://production-db',
  });
  assert.deepEqual(result, {
    ok: false,
    error: 'DATABASE_URL must exactly match PREVIEW_DATABASE_URL before Preview seeding.',
  });
});

test('requires a bounded Preview test password', () => {
  assert.equal(validatePreviewSeedSafety({ ...valid, testPassword: 'short' }).ok, false);
  assert.equal(validatePreviewSeedSafety({ ...valid, testPassword: 'a'.repeat(129) }).ok, false);
});
