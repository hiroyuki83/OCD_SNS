import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
const publicAction = readFileSync(
  join(process.cwd(), 'src', 'app', 'appeal', 'actions.ts'),
  'utf8',
);
const reviewAction = readFileSync(
  join(
    process.cwd(),
    'src',
    'app',
    'moderation',
    'appeals',
    'sanctions',
    'actions.ts',
  ),
  'utf8',
);
const appealPage = readFileSync(
  join(process.cwd(), 'src', 'app', 'appeal', 'page.tsx'),
  'utf8',
);
const seed = readFileSync(
  join(process.cwd(), 'prisma', 'seed-preview.ts'),
  'utf8',
);
const authConfig = readFileSync(
  join(process.cwd(), 'src', 'auth.config.ts'),
  'utf8',
);

test('sanction appeals use a foreign-keyed one-to-one Appeal model', () => {
  assert.match(schema, /model Appeal \{/);
  assert.match(schema, /sanctionId\s+String\s+@unique/);
  assert.match(schema, /sanction\s+Sanction\s+@relation/);
  assert.match(schema, /status\s+AppealStatus\s+@default\(PENDING\)/);
});

test('public sanction appeal verifies credentials without creating a login session', () => {
  assert.match(publicAction, /bcrypt\.compare/);
  assert.match(publicAction, /DUMMY_PASSWORD_HASH/);
  assert.match(publicAction, /sanction-appeal-auth:/);
  assert.doesNotMatch(publicAction, /\bsignIn\s*\(/);
  assert.doesNotMatch(publicAction, /\bauth\s*\(/);
});

test('public appeal only targets current active restrictions or suspensions', () => {
  assert.match(publicAction, /SanctionType\.POST_RESTRICTION/);
  assert.match(publicAction, /SanctionType\.SUSPENSION/);
  assert.match(publicAction, /status:\s*SanctionStatus\.ACTIVE/);
  assert.match(publicAction, /endsAt:\s*\{ gt: now \}/);
  assert.match(publicAction, /SANCTION_APPEAL_SUBMITTED/);
});

test('sanction appeal review prevents self-review and sanction-author review', () => {
  assert.match(reviewAction, /appeal\.userId === actor\.id/);
  assert.match(reviewAction, /appeal\.sanction\.actorUserId === actor\.id/);
  assert.match(reviewAction, /appeal\.user\.role !== Role\.USER/);
});

test('overturn revokes the sanction without clearing a newer active sanction', () => {
  assert.match(reviewAction, /status:\s*SanctionStatus\.REVOKED/);
  assert.match(reviewAction, /id:\s*\{ not: appeal\.sanctionId \}/);
  assert.match(reviewAction, /if \(!otherActive\)/);
  assert.match(reviewAction, /status:\s*AccountStatus\.ACTIVE/);
});

test('review persists audit evidence and sends a result email when configured', () => {
  assert.match(reviewAction, /SANCTION_APPEAL_REVIEWED/);
  assert.match(reviewAction, /isEmailDeliveryConfigured/);
  assert.match(reviewAction, /sendTransactionalEmail/);
  assert.match(reviewAction, /SANCTION_APPEAL_RESULT_EMAIL_FAILED/);
});

test('appeal page explicitly states that no normal login session is created', () => {
  assert.match(appealPage, /通常のログインセッションは作成されません/);
  assert.match(appealPage, /異議申立てを送信・状況確認/);
});


test('Preview seed clears test-user sanction and appeal state', () => {
  assert.match(seed, /prisma\.appeal\.deleteMany/);
  assert.match(seed, /prisma\.sanction\.deleteMany/);
});


test('appeal route remains outside the authenticated protected-prefix list', () => {
  const protectedList = authConfig.match(/const protectedPrefixes = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.equal(protectedList.includes("'\/appeal'"), false);
});
