import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const modulePath = '../src/lib/productionMigrationSafety.ts';

test('production migration safety module exists', () => {
  assert.equal(existsSync(new URL(modulePath, import.meta.url)), true);
});

async function loadSafety() {
  if (!existsSync(new URL(modulePath, import.meta.url))) return null;
  return import(modulePath);
}

const validInput = {
  vercelEnv: 'production',
  gitRef: 'main',
  databaseUrl: 'postgresql://user:pass@prod.example.neon.tech/appdb?sslmode=verify-full',
  productionDatabaseUrl: 'postgresql://user:pass@prod.example.neon.tech/appdb?sslmode=verify-full',
  expectedHost: 'prod.example.neon.tech',
  expectedDatabaseName: 'appdb',
  confirmation: 'CHECK_COCO_PRODUCTION',
};

test('rejects shared Preview database hosts', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const previewUrl =
    'postgresql://user:pass@ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full';

  const result = mod.validateProductionMigrationSafety({
    ...validInput,
    databaseUrl: previewUrl,
    productionDatabaseUrl: previewUrl,
    expectedHost: 'ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech',
    expectedDatabaseName: 'neondb',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /Preview/i);
});

test('rejects non-main refs', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const result = mod.validateProductionMigrationSafety({
    ...validInput,
    gitRef: 'feature/sanction-appeals-20260928',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /main/);
});

test('requires explicit production confirmation', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const result = mod.validateProductionMigrationSafety({
    ...validInput,
    confirmation: '',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /CHECK_COCO_PRODUCTION/);
});

test('rejects host mismatch', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const result = mod.validateProductionMigrationSafety({
    ...validInput,
    expectedHost: 'other.example.neon.tech',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /host/i);
});

test('rejects database-name mismatch', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const result = mod.validateProductionMigrationSafety({
    ...validInput,
    expectedDatabaseName: 'otherdb',
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /database/i);
});

test('accepts an explicitly identified production database', async () => {
  const mod = await loadSafety();
  if (!mod) return;

  const result = mod.validateProductionMigrationSafety(validInput);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.hostname, 'prod.example.neon.tech');
    assert.equal(result.databaseName, 'appdb');
  }
});


test('production DB preflight script is wired into package scripts', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
  );
  assert.equal(
    packageJson.scripts?.['production:db:preflight'],
    'tsx scripts/production-db-preflight.ts',
  );
  assert.equal(
    existsSync(resolve(process.cwd(), 'scripts/production-db-preflight.ts')),
    true,
  );
});

test('production DB preflight is read-only and never invokes Prisma migrate', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const path = resolve(process.cwd(), 'scripts/production-db-preflight.ts');
  if (!existsSync(path)) return;
  const source = readFileSync(path, 'utf8');

  assert.doesNotMatch(source, /prisma\s+migrate|migrate\s+deploy|spawnSync|execSync/);
  assert.match(source, /_prisma_migrations/);
  assert.match(source, /resolve\(process\.cwd\(\), 'prisma', 'migrations'\)/);
});


test('production preflight reports destructive-migration row counts', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /replyRows/);
  assert.match(source, /quotedPosts/);
  assert.match(source, /followRows/);
  assert.match(source, /userRows/);
  assert.match(source, /postRows/);
});

test('manual Production preflight workflow exists and uses only the Production DB secret', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const workflowPath = resolve(
    process.cwd(),
    '.github/workflows/production-db-preflight.yml',
  );
  assert.equal(existsSync(workflowPath), true);
  if (!existsSync(workflowPath)) return;

  const source = readFileSync(workflowPath, 'utf8');
  assert.match(source, /workflow_dispatch/);
  assert.match(source, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.match(source, /ep-billowing-smoke-ah3grpmy-pooler\.c-3\.us-east-1\.aws\.neon\.tech/);
  assert.match(source, /PRODUCTION_DATABASE_NAME: neondb/);
  assert.match(source, /npm run production:db:preflight/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
});


test('production DB preflight uses an async entrypoint compatible with CommonJS tsx execution', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /async function main\(\)/);
  assert.match(source, /main\(\)\.catch/);

  const beforeMain = source.split('async function main()')[0] ?? '';
  assert.doesNotMatch(beforeMain, /^\s*await\s/m);
});


test('production preflight reports blockers only after read-only diagnostics', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /migrationHistoryIssues/);
  assert.match(source, /migrationHistoryRowCount/);
  assert.match(source, /applied_steps_count/);
  assert.match(source, /started_at/);

  const reportIndex = source.indexOf("console.log(JSON.stringify(report, null, 2))");
  const blockerThrowIndex = source.indexOf("Production preflight blockers:");
  assert.ok(reportIndex >= 0);
  assert.ok(blockerThrowIndex > reportIndex);
});


test('production preflight diagnoses pending schema object collisions', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /tableColumns/);
  assert.match(source, /tableConstraints/);
  assert.match(source, /enumValues/);
  assert.match(source, /moderationConflictDiagnostics/);
  assert.match(source, /pendingObjectCollisions/);
  assert.match(source, /ModerationWarning/);
  assert.match(source, /WarningAppeal/);
  assert.match(source, /Appeal/);
});


test('Production preflight expands legacy moderation reconciliation diagnostics', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /ModerationAction:/);
  assert.match(source, /optionalRowCount\('ModerationAction'\)/);
  assert.match(source, /tableColumns\('ModerationAction'\)/);
  assert.match(source, /tableConstraints\('ModerationAction'\)/);
  assert.match(source, /JSON\.stringify\(report, null, 2\)/);
});


test('production preflight distinguishes historical rollbacks from active migration failures', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /rolledBackMigrations/);
  assert.match(source, /unfinishedMigrations/);
  assert.match(source, /if \(unfinishedMigrations\.length\)/);
  assert.doesNotMatch(
    source,
    /if \(migrationHistoryIssues\.length\) \{\s*blockers\.push/s,
  );
});

test('production preflight diagnoses legacy moderation cleanup prerequisites', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  const source = readFileSync(
    resolve(process.cwd(), 'scripts/production-db-preflight.ts'),
    'utf8',
  );

  assert.match(source, /moderationNotificationRows/);
  assert.match(source, /restrictionUntilUsers/);
  assert.match(source, /enumValues\('NotificationType'\)/);
  assert.match(source, /enumValues\('ModerationActionType'\)/);
  assert.match(source, /User\.restrictionUntil already exists before its pending migration/);
  assert.match(source, /AppealStatus enum already exists before the pending Sanction Appeal migration/);
});
