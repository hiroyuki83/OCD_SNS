import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PREVIEW_MIGRATION_CONFIRMATION,
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

const validUrl =
  'postgresql://preview_user:preview_password@ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const valid = {
  vercelEnv: 'preview',
  gitRef: 'feature/sanction-records-20260928',
  databaseUrl: validUrl,
  previewDatabaseUrl: validUrl,
  confirmation: PREVIEW_MIGRATION_CONFIRMATION,
};

test('accepts the approved coco-preview database only with explicit confirmation', () => {
  const result = validatePreviewMigrationSafety(valid);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.databaseName, 'neondb');
    assert.equal(
      result.hostname,
      'ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech',
    );
  }
});

test('rejects production environment', () => {
  assert.equal(
    validatePreviewMigrationSafety({ ...valid, vercelEnv: 'production' }).ok,
    false,
  );
});

test('rejects main or another branch', () => {
  assert.equal(validatePreviewMigrationSafety({ ...valid, gitRef: 'main' }).ok, false);
});

test('rejects missing migration confirmation', () => {
  assert.equal(
    validatePreviewMigrationSafety({ ...valid, confirmation: '' }).ok,
    false,
  );
});

test('rejects mismatched DATABASE_URL and PREVIEW_DATABASE_URL', () => {
  const result = validatePreviewMigrationSafety({
    ...valid,
    databaseUrl: 'postgresql://prod.example.com/prod',
  });
  assert.deepEqual(result, {
    ok: false,
    error: 'DATABASE_URL must exactly match PREVIEW_DATABASE_URL.',
  });
});

test('rejects an unapproved PostgreSQL host', () => {
  const other =
    'postgresql://user:password@production.example.com/neondb?sslmode=require';
  assert.equal(
    validatePreviewMigrationSafety({
      ...valid,
      databaseUrl: other,
      previewDatabaseUrl: other,
    }).ok,
    false,
  );
});

test('rejects a different database name on the approved host', () => {
  const other =
    'postgresql://user:password@ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech/production?sslmode=require';
  assert.equal(
    validatePreviewMigrationSafety({
      ...valid,
      databaseUrl: other,
      previewDatabaseUrl: other,
    }).ok,
    false,
  );
});
