import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Vercel Preview build never mutates or seeds Preview DB', () => {
  const source = readFileSync('scripts/vercel-build.mjs', 'utf8');
  assert.ok(!source.includes("seed-preview.ts"));
  assert.ok(!source.includes("PREVIEW_SEED_USERS"));
});

test('Production migration remains restricted to VERCEL_ENV=production', () => {
  const source = readFileSync('scripts/vercel-build.mjs', 'utf8');
  assert.ok(source.includes("if (process.env.VERCEL_ENV === 'production')"));
  assert.ok(source.includes("run(['prisma', 'migrate', 'deploy'])"));
});
