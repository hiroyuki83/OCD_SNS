import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Prisma config prioritizes PREVIEW_DATABASE_URL in Vercel Preview', () => {
  const source = readFileSync('prisma.config.ts', 'utf8');
  const previewIndex = source.indexOf('previewMigrateUrl');
  const fallbackIndex = source.indexOf('process.env.POSTGRES_URL_NON_POOLING?.trim()');

  assert.ok(previewIndex >= 0, 'preview migration URL selector must exist');
  assert.ok(
    source.includes('process.env.VERCEL_ENV?.trim() === "preview"'),
    'preview database override must be limited to Vercel Preview',
  );
  assert.ok(
    source.includes('process.env.PREVIEW_DATABASE_URL?.trim()'),
    'Preview migrations must use PREVIEW_DATABASE_URL',
  );
  assert.ok(
    fallbackIndex > previewIndex,
    'production-style fallback URLs must come after the Preview override',
  );
});

test('Preview DB workflow is manual-only and requires exact confirmation', () => {
  const source = readFileSync('.github/workflows/preview-db-release.yml', 'utf8');

  assert.ok(source.includes('workflow_dispatch:'));
  assert.ok(!source.includes('\n  push:'));
  assert.ok(!source.includes('\n  pull_request:'));
  assert.ok(source.includes("inputs.confirmation == 'MIGRATE_COCO_PREVIEW'"));
  assert.ok(source.includes("github.ref_name == 'security-integration-final-20260926'"));
  assert.ok(source.includes('secrets.PREVIEW_DATABASE_URL'));
});
