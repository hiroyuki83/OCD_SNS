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
