import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
const moderationActions = readFileSync(
  join(process.cwd(), 'src', 'app', 'moderation', 'actions.ts'),
  'utf8',
);
const adminUserPage = readFileSync(
  join(process.cwd(), 'src', 'app', 'admin', 'users', '[id]', 'page.tsx'),
  'utf8',
);

test('schema contains first-class sanction records with target actor and report links', () => {
  assert.match(schema, /model Sanction \{/);
  assert.match(schema, /type\s+SanctionType/);
  assert.match(schema, /status\s+SanctionStatus/);
  assert.match(schema, /targetUserId\s+String/);
  assert.match(schema, /actorUserId\s+String/);
  assert.match(schema, /reportId\s+String\?/);
});

test('moderation status changes persist and reference a sanction record', () => {
  assert.match(moderationActions, /tx\.sanction\.create/);
  assert.match(moderationActions, /SanctionType\.POST_RESTRICTION/);
  assert.match(moderationActions, /SanctionType\.SUSPENSION/);
  assert.match(moderationActions, /sanctionId,/);
});

test('new sanctions supersede prior active sanctions without deleting history', () => {
  assert.match(moderationActions, /status:\s*SanctionStatus\.EXPIRED/);
  assert.match(moderationActions, /status:\s*SanctionStatus\.REVOKED/);
  assert.match(moderationActions, /revokedAt:\s*sanctionChangedAt/);
  assert.doesNotMatch(moderationActions, /tx\.sanction\.deleteMany/);
});

test('admin user detail reads and displays sanction history', () => {
  assert.match(adminUserPage, /prisma\.sanction\.findMany/);
  assert.match(adminUserPage, />処分履歴<\/h2>/);
  assert.match(adminUserPage, /sanctionStatusLabels/);
});
