import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  PREVIEW_DEFERRED_MIGRATIONS,
  PREVIEW_EXPECTED_MIGRATIONS,
  PREVIEW_HISTORICAL_MIGRATIONS,
  PREVIEW_PENDING_MIGRATIONS,
} from '../src/lib/previewMigrationPlan';

test('Preview migration plan exactly matches repository migrations', () => {
  const migrationRoot = join(process.cwd(), 'prisma', 'migrations');
  const repositoryMigrations = readdirSync(migrationRoot)
    .filter((name) => statSync(join(migrationRoot, name)).isDirectory())
    .filter((name) => statSync(join(migrationRoot, name, 'migration.sql')).isFile())
    .sort();

  assert.deepEqual([...PREVIEW_EXPECTED_MIGRATIONS].sort(), repositoryMigrations);
});

test('Preview historical, pending and deferred migration sets do not overlap', () => {
  const historical = new Set<string>(PREVIEW_HISTORICAL_MIGRATIONS);
  const pending = new Set<string>(PREVIEW_PENDING_MIGRATIONS);
  assert.deepEqual(
    PREVIEW_PENDING_MIGRATIONS.filter((name) => historical.has(name)),
    [],
  );
  assert.deepEqual(
    PREVIEW_DEFERRED_MIGRATIONS.filter(
      (name) => historical.has(name) || pending.has(name),
    ),
    [],
  );
});

test('Preview pending migration order is the release order', () => {
  assert.deepEqual(PREVIEW_PENDING_MIGRATIONS, [
    '20260928110500_add_sanction_appeals',
  ]);
});

test('sanction migration is historical after shared Preview acceptance', () => {
  assert.ok(
    PREVIEW_HISTORICAL_MIGRATIONS.includes(
      '20260928071000_add_sanction_records',
    ),
  );
});

test('no migration stays deferred for the appeal Preview release', () => {
  assert.deepEqual(PREVIEW_DEFERRED_MIGRATIONS, []);
});
