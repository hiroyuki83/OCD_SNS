import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizePostgresSslMode,
  selectMigrationDatabaseUrl,
  selectRuntimeDatabaseUrl,
} from '../src/lib/databaseUrl';

test('runtime prefers pooled database URLs before non-pooling fallback', () => {
  const result = selectRuntimeDatabaseUrl({
    DATABASE_URL: 'postgresql://pooled-runtime',
    POSTGRES_PRISMA_URL: 'postgresql://prisma-pooler',
    POSTGRES_URL_NON_POOLING: 'postgresql://direct',
  });

  assert.equal(result, 'postgresql://pooled-runtime');
});

test('runtime falls back to Prisma pooler before non-pooling URL', () => {
  const result = selectRuntimeDatabaseUrl({
    POSTGRES_PRISMA_URL: 'postgresql://prisma-pooler',
    POSTGRES_URL_NON_POOLING: 'postgresql://direct',
  });

  assert.equal(result, 'postgresql://prisma-pooler');
});

test('migration prefers non-pooling database URL', () => {
  const result = selectMigrationDatabaseUrl({
    DATABASE_URL: 'postgresql://pooled-runtime',
    POSTGRES_PRISMA_URL: 'postgresql://prisma-pooler',
    POSTGRES_URL_NON_POOLING: 'postgresql://direct',
  });

  assert.equal(result, 'postgresql://direct');
});

test('Preview database URL overrides runtime and migration URLs', () => {
  const env = {
    VERCEL_ENV: 'preview',
    PREVIEW_DATABASE_URL: 'postgresql://preview',
    DATABASE_URL: 'postgresql://runtime',
    POSTGRES_URL_NON_POOLING: 'postgresql://direct',
  };

  assert.equal(selectRuntimeDatabaseUrl(env), 'postgresql://preview');
  assert.equal(selectMigrationDatabaseUrl(env), 'postgresql://preview');
});

test('database URL selectors ignore blank values', () => {
  assert.equal(
    selectRuntimeDatabaseUrl({
      DATABASE_URL: '   ',
      POSTGRES_PRISMA_URL: ' postgresql://pooler ',
    }),
    'postgresql://pooler',
  );
  assert.equal(
    selectMigrationDatabaseUrl({
      POSTGRES_URL_NON_POOLING: '',
      DATABASE_URL: ' postgresql://runtime ',
    }),
    'postgresql://runtime',
  );
});

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
