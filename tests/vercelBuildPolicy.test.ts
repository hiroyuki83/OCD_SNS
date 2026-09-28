import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Vercel Preview build never mutates or seeds Preview DB', () => {
  const source = readFileSync('scripts/vercel-build.mjs', 'utf8');
  assert.ok(!source.includes("seed-preview.ts"));
  assert.ok(!source.includes("PREVIEW_SEED_USERS"));
});

test('Production build validates required env without mutating the database', () => {
  const source = readFileSync('scripts/vercel-build.mjs', 'utf8');
  assert.ok(source.includes("if (process.env.VERCEL_ENV === 'production')"));
  assert.ok(source.includes("requireProductionEnv('DATABASE_URL')"));
  assert.ok(source.includes("requireProductionEnv('STAFF_MFA_ENCRYPTION_KEY')"));
  assert.ok(
    source.includes(
      'Missing required production authentication secret: AUTH_SECRET (or legacy NEXTAUTH_SECRET).',
    ),
  );
  assert.ok(!source.includes("run(['prisma', 'migrate', 'deploy'])"));
  assert.ok(!source.includes('prisma migrate deploy'));
});
