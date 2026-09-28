import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const route = readFileSync(
  join(process.cwd(), 'src', 'app', 'api', 'account', 'export', 'route.ts'),
  'utf8',
);

test('account export route never selects authentication secrets', () => {
  for (const forbidden of [
    'staffTotpSecretEncrypted: true',
    'password: true',
    'codeHash: true',
    'tokenHash: true',
  ]) {
    assert.equal(route.includes(forbidden), false, forbidden);
  }
});

test('account export route explicitly excludes internal-only records', () => {
  assert.match(route, /internal admin notes/);
  assert.match(route, /internal audit logs/);
});

test('account export route applies an authenticated userId scope to self-test queries', () => {
  for (const model of ['ybocsResult', 'iesrResult', 'itqResult', 'lsasResult']) {
    const query = new RegExp(
      String.raw`prisma\.${model}\.findMany\(\{\s*where:\s*\{\s*userId\s*\}`,
    );
    assert.match(route, query);
  }
});


test('account export scopes sanction history to the authenticated user', () => {
  assert.match(
    route,
    /prisma\.sanction\.findMany\(\{\s*where:\s*\{\s*targetUserId:\s*userId\s*\}/,
  );
  assert.match(route, /appeal:\s*\{\s*select:/);
  assert.match(route, /moderation:\s*\{ reportsMade, reportsTargetingUser, warnings, sanctions \}/);
});
