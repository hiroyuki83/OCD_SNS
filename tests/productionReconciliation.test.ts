import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const reconciliationSql = readFileSync(
  'scripts/production-legacy-moderation-reconcile.sql',
  'utf8',
);
const workflow = readFileSync(
  '.github/workflows/production-reconciliation-dry-run.yml',
  'utf8',
);

test('legacy moderation reconciliation is transactional and guarded', () => {
  assert.match(reconciliationSql, /^BEGIN;/);
  assert.match(reconciliationSql, /COMMIT;\s*$/);
  assert.match(reconciliationSql, /SET LOCAL lock_timeout = '5s'/);
  assert.match(reconciliationSql, /SET LOCAL statement_timeout = '30s'/);
  assert.match(reconciliationSql, /ModerationAction contains % rows/);
  assert.match(reconciliationSql, /Legacy Appeal contains % rows/);
  assert.match(reconciliationSql, /MODERATION notifications contain % rows/);
  assert.match(reconciliationSql, /Appeal already looks like the current Sanction Appeal schema/);
});

test('legacy moderation reconciliation removes only obsolete empty schema objects', () => {
  assert.match(reconciliationSql, /DROP TABLE "Appeal"/);
  assert.match(reconciliationSql, /DROP TABLE "ModerationAction"/);
  assert.match(reconciliationSql, /DROP TYPE "AppealStatus"/);
  assert.match(reconciliationSql, /DROP TYPE "ModerationActionType"/);
  assert.doesNotMatch(reconciliationSql, /DROP TABLE "User"/);
  assert.doesNotMatch(reconciliationSql, /DROP TABLE "Post"/);
  assert.doesNotMatch(reconciliationSql, /DELETE FROM "User"/);
  assert.doesNotMatch(reconciliationSql, /DELETE FROM "Post"/);
});

test('legacy moderation reconciliation restores current NotificationType values', () => {
  assert.match(reconciliationSql, /ALTER TYPE "NotificationType" RENAME TO "NotificationType_legacy"/);
  assert.match(
    reconciliationSql,
    /CREATE TYPE "NotificationType" AS ENUM \('LIKE', 'FOLLOW', 'WAKARU', 'GANBATTA'\)/,
  );
  assert.match(reconciliationSql, /DROP TYPE "NotificationType_legacy"/);
});

test('legacy migration history is retained as rolled back for auditability', () => {
  assert.match(
    reconciliationSql,
    /20260926073000_add_moderation_actions_and_appeals/,
  );
  assert.match(reconciliationSql, /SET rolled_back_at = CURRENT_TIMESTAMP/);
  assert.doesNotMatch(reconciliationSql, /DELETE FROM "_prisma_migrations"/);
});

test('reconciliation dry run never uses Production secrets or remote deployment', () => {
  assert.match(workflow, /postgres:16/);
  assert.match(workflow, /127\.0\.0\.1:5432\/coco_reconcile/);
  assert.doesNotMatch(workflow, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(workflow, /deploy_to_vercel|vercel deploy|production deployment/i);
});

test('reconciliation dry run reproduces legacy state and validates the final current schema', () => {
  assert.match(workflow, /20260926073000_add_moderation_actions_and_appeals/);
  assert.match(workflow, /Confirm legacy state is blocked by read-only preflight/);
  assert.match(
    workflow,
    /prisma migrate resolve --applied 20260926103000_add_restriction_until/,
  );
  assert.match(workflow, /Apply remaining current migrations/);
  assert.match(workflow, /Verify reconciled schema with Production preflight/);
});


test('dry run restores current migrations before asserting the legacy Production blocker', () => {
  const restoreIndex = workflow.indexOf('Restore current migration set');
  const blockedIndex = workflow.indexOf(
    'Confirm legacy state is blocked by read-only preflight',
  );

  assert.ok(restoreIndex >= 0);
  assert.ok(blockedIndex >= 0);
  assert.ok(restoreIndex < blockedIndex);
});
