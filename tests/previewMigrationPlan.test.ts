import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
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

test('Preview historical and pending migration sets do not overlap', () => {
  const historical = new Set<string>(PREVIEW_HISTORICAL_MIGRATIONS);
  const duplicates = PREVIEW_PENDING_MIGRATIONS.filter((name) => historical.has(name));
  assert.deepEqual(duplicates, []);
});

test('Preview pending migration order is the release order', () => {
  assert.deepEqual(PREVIEW_PENDING_MIGRATIONS, [
    '20260928013000_remove_reply_and_quote_post',
    '20260928014500_add_post_image_alt',
    '20260928023000_add_notification_preferences',
    '20260928031500_add_email_change_pending',
  ]);
});
