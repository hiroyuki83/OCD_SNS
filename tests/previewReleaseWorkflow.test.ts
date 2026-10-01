import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Prisma config delegates migration URL selection to the guarded selector', () => {
  const source = readFileSync('prisma.config.ts', 'utf8');

  assert.ok(
    source.includes('selectMigrationDatabaseUrl(process.env)'),
    'Prisma config must use the shared migration URL selector',
  );
  assert.ok(
    source.includes('normalizePostgresSslMode(rawMigrateUrl)'),
    'Prisma config must normalize the selected migration URL',
  );
});

test('Preview DB workflow is manual-only and requires exact confirmation', () => {
  const source = readFileSync('.github/workflows/preview-db-release.yml', 'utf8');

  assert.ok(source.includes('workflow_dispatch:'));
  assert.ok(!source.includes('\n  push:'));
  assert.ok(!source.includes('\n  pull_request:'));
  assert.ok(source.includes("inputs.confirmation == 'MIGRATE_COCO_PREVIEW'"));
  assert.ok(source.includes("github.ref_name == 'feature/sanction-appeals-20260928'"));
  assert.ok(source.includes("PREVIEW_ALLOW_BASELINE: '0'"));
  assert.ok(!source.includes('allow_baseline:'));
  assert.ok(source.includes('secrets.PREVIEW_DATABASE_URL'));
});


test('guarded migration runner always performs preflight and post-migration verification', () => {
  const source = readFileSync('scripts/migrate-preview.ts', 'utf8');
  const preflight = source.indexOf("scripts/preview-db-preflight.ts");
  const deploy = source.indexOf("runPrisma(['migrate', 'deploy'])");
  const verify = source.indexOf("scripts/preview-db-verify.ts");

  assert.ok(preflight >= 0, 'migration runner must invoke Preview DB preflight');
  assert.ok(deploy > preflight, 'migration deploy must happen after preflight');
  assert.ok(verify > deploy, 'schema verification must happen after migration deploy');
});


test('Preview migration runner refuses to apply deferred migrations', () => {
  const source = readFileSync('scripts/migrate-preview.ts', 'utf8');
  assert.match(source, /PREVIEW_DEFERRED_MIGRATIONS\.length > 0/);
  assert.match(source, /Preview migration is blocked because deferred migrations are present/);
});


test('Appeal release preflight requires accepted Sanction schema and absent Appeal table', () => {
  const source = readFileSync('scripts/preview-db-preflight.ts', 'utf8');
  assert.ok(source.includes("['Sanction table already present', signatures.sanction]"));
  assert.ok(source.includes("['Appeal table not yet present', !signatures.appeal]"));
});

test('Appeal release verification requires Appeal schema', () => {
  const source = readFileSync('scripts/preview-db-verify.ts', 'utf8');
  assert.ok(source.includes("['Appeal table added', await tableExists('Appeal')]"));
  assert.ok(source.includes("['Appeal.sanctionId added', await columnExists('Appeal', 'sanctionId')]"));
  assert.ok(source.includes("['Appeal.userId added', await columnExists('Appeal', 'userId')]"));
});
