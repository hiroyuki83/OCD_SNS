import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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


test('legacy monolithic Production reconciliation apply path is deprecated and blocked', () => {
  const path = '.github/workflows/production-reconciliation-apply.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /deprecated and intentionally blocked/);
  assert.match(source, /Production Stage A Apply/);
  assert.match(source, /Production Stage C Apply/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
  assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL_UNPOOLED/);
  assert.doesNotMatch(source, /vercel deploy|deploy_to_vercel/i);
});

test('Production reconciliation precheck exists and is read-only', () => {
  const path = 'scripts/production-reconciliation-precheck.ts';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /ModerationAction/);
  assert.match(source, /Appeal/);
  assert.match(source, /MODERATION/);
  assert.match(source, /restrictionUntil/);
  assert.match(source, /20260926073000_add_moderation_actions_and_appeals/);
  assert.doesNotMatch(source, /INSERT\s+INTO/i);
  assert.doesNotMatch(source, /UPDATE\s+/i);
  assert.doesNotMatch(source, /DELETE\s+FROM/i);
  assert.doesNotMatch(source, /DROP\s+/i);
  assert.doesNotMatch(source, /ALTER\s+/i);
  assert.doesNotMatch(source, /CREATE\s+/i);
});


test('Production Stage A workflows stop before the destructive Reply/Quote boundary', () => {
  const dryRunPath = '.github/workflows/production-stage-a-dry-run.yml';
  const applyPath = '.github/workflows/production-stage-a-apply.yml';
  const verifyPath = 'scripts/production-stage-a-verify.ts';

  assert.equal(existsSync(dryRunPath), true);
  assert.equal(existsSync(applyPath), true);
  assert.equal(existsSync(verifyPath), true);
  if (!existsSync(dryRunPath) || !existsSync(applyPath) || !existsSync(verifyPath)) return;

  const dryRun = readFileSync(dryRunPath, 'utf8');
  const apply = readFileSync(applyPath, 'utf8');
  const verify = readFileSync(verifyPath, 'utf8');

  assert.match(dryRun, /20260927002000_add_follow_approval/);
  assert.match(dryRun, /production-stage-a-verify\.ts/);
  assert.match(apply, /workflow_dispatch/);
  assert.match(apply, /APPLY_COCO_PRODUCTION_STAGE_A/);
  assert.match(apply, /stage_a_dry_run_id:/);
  assert.match(apply, /production-db-preflight\.yml/);
  assert.match(apply, /production-stage-a-dry-run\.yml/);
  assert.match(apply, /20260927002000_add_follow_approval/);
  assert.doesNotMatch(apply, /BRIDGE_PRODUCTION_VERIFIED/);

  assert.match(verify, /20260927002000_add_follow_approval/);
  assert.match(verify, /20260928013000_remove_reply_and_quote_post/);
  assert.match(verify, /Reply table must still exist after Stage A/);
  assert.match(verify, /Post\.quotePostId must still exist after Stage A/);
  assert.match(verify, /Sanction must remain absent/);
  assert.doesNotMatch(verify, /INSERT\s+INTO/i);
  assert.doesNotMatch(verify, /UPDATE\s+/i);
  assert.doesNotMatch(verify, /DELETE\s+FROM/i);
  assert.doesNotMatch(verify, /DROP\s+/i);
  assert.doesNotMatch(verify, /ALTER\s+/i);
  assert.doesNotMatch(verify, /CREATE\s+/i);
});


test('Production bridge validation proves the approved bridge against a Stage A database', () => {
  const path = '.github/workflows/production-bridge-validation.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /64d5ad3fbc4e09f87ba8a09fdd75a9f823bccda1/);
  assert.match(source, /20260927002000_add_follow_approval/);
  assert.match(source, /production-stage-a-verify\.ts/);
  assert.match(source, /Build approved bridge against Stage A database/);
  assert.match(source, /api\/feed\?limit=1/);
  assert.doesNotMatch(source, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(source, /vercel deploy|deploy_to_vercel/i);
});

test('Production Stage C precheck is read-only and requires the Stage A boundary', () => {
  const path = 'scripts/production-stage-c-precheck.ts';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');
  assert.match(source, /20260927002000_add_follow_approval/);
  assert.match(source, /20260928013000_remove_reply_and_quote_post/);
  assert.match(source, /Reply contains/);
  assert.match(source, /Quote data contains/);
  assert.match(source, /legacy ModerationAction must be absent after Stage A/);
  assert.match(source, /Appeal must be absent before Sanction Appeal migration/);
  assert.doesNotMatch(source, /INSERT\s+INTO/i);
  assert.doesNotMatch(source, /UPDATE\s+/i);
  assert.doesNotMatch(source, /DELETE\s+FROM/i);
  assert.doesNotMatch(source, /DROP\s+/i);
  assert.doesNotMatch(source, /ALTER\s+/i);
  assert.doesNotMatch(source, /CREATE\s+/i);
});

test('Production Stage C is independently dry-run and heavily gated', () => {
  const dryRunPath = '.github/workflows/production-stage-c-dry-run.yml';
  const applyPath = '.github/workflows/production-stage-c-apply.yml';
  assert.equal(existsSync(dryRunPath), true);
  assert.equal(existsSync(applyPath), true);
  if (!existsSync(dryRunPath) || !existsSync(applyPath)) return;

  const dryRun = readFileSync(dryRunPath, 'utf8');
  const apply = readFileSync(applyPath, 'utf8');

  assert.match(dryRun, /Verify Stage C preconditions/);
  assert.match(dryRun, /Apply Stage C migrations/);
  assert.match(dryRun, /Verify final current schema/);

  assert.match(apply, /workflow_dispatch/);
  assert.match(apply, /APPLY_COCO_PRODUCTION_STAGE_C/);
  assert.match(apply, /stage_a_apply_run_id:/);
  assert.match(apply, /stage_c_dry_run_id:/);
  assert.match(apply, /bridge_validation_run_id:/);
  assert.match(apply, /BRIDGE_PRODUCTION_VERIFIED/);
  assert.match(apply, /64d5ad3fbc4e09f87ba8a09fdd75a9f823bccda1/);
  assert.match(apply, /production-stage-a-apply\.yml/);
  assert.match(apply, /production-stage-c-dry-run\.yml/);
  assert.match(apply, /production-bridge-validation\.yml/);
  assert.match(apply, /production:db:preflight/);
  assert.match(apply, /production-stage-c-precheck\.ts/);
  assert.match(apply, /prisma migrate deploy/);
  assert.doesNotMatch(apply, /production-legacy-moderation-reconcile\.sql/);
  assert.doesNotMatch(apply, /prisma migrate resolve --applied 20260926103000_add_restriction_until/);
  assert.doesNotMatch(apply, /vercel deploy|deploy_to_vercel/i);
});


test('Production final release validation exercises current main after the full staged migration path', () => {
  const path = '.github/workflows/production-final-validation.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /Reproduce legacy Production state/);
  assert.match(source, /Apply Stage A migrations only/);
  assert.match(source, /Verify Stage C preconditions/);
  assert.match(source, /Apply Stage C migrations/);
  assert.match(source, /Verify final Production schema/);
  assert.match(source, /Build current main against migrated Production-shaped database/);
  assert.match(source, /api\/feed\?limit=1/);
  assert.doesNotMatch(source, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(source, /vercel deploy|deploy_to_vercel/i);
});


test('Production deploy readiness gate verifies all same-SHA release attestations without deploying', () => {
  const path = '.github/workflows/production-deploy-readiness.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /stage_c_apply_run_id:/);
  assert.match(source, /post_stage_c_preflight_run_id:/);
  assert.match(source, /final_validation_run_id:/);
  assert.match(source, /security_ci_run_id:/);
  assert.match(source, /e2e_run_id:/);
  assert.match(source, /branches\/main/);
  assert.match(source, /production-stage-c-apply\.yml/);
  assert.match(source, /production-db-preflight\.yml/);
  assert.match(source, /production-final-validation\.yml/);
  assert.match(source, /security-integration-ci\.yml/);
  assert.match(source, /e2e\.yml/);
  assert.match(source, /Production deploy readiness: PASS/);
  assert.match(source, /does not deploy Production/);
  assert.doesNotMatch(source, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(source, /vercel deploy|deploy_to_vercel/i);
});


test('Production rollback point verification is read-only and validates a fresh Neon child branch', () => {
  const path = '.github/workflows/production-rollback-point-verify.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /rollback_branch_id:/);
  assert.match(source, /expected_branch_name:/);
  assert.match(source, /max_age_minutes:/);
  assert.match(source, /withered-lab-08522436/);
  assert.match(source, /console\.neon\.tech\/api\/v2\/projects/);
  assert.match(source, /Authorization: Bearer/);
  assert.match(source, /\.default == true/);
  assert.match(source, /parent_id/);
  assert.match(source, /created_at/);
  assert.match(source, /include_deleted=false/);
  assert.match(source, /read-only/);
  assert.doesNotMatch(source, /--request POST|--request PATCH|--request DELETE|--request PUT/);
});

test('Production Stage A and Stage C apply require rollback verification attestation', () => {
  for (const path of [
    '.github/workflows/production-stage-a-apply.yml',
    '.github/workflows/production-stage-c-apply.yml',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /rollback_verification_run_id:/);
    assert.match(source, /ROLLBACK_VERIFICATION_RUN_ID/);
    assert.match(source, /Verify rollback point attestation/);
    assert.match(source, /production-rollback-point-verify\.yml/);
    assert.match(source, /Production rollback verify \$\{ROLLBACK_POINT\}/);
  }
});


test('Production rollback point creation is manual, protected, and compute-free', () => {
  const path = '.github/workflows/production-rollback-point-create.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /CREATE_COCO_PRODUCTION_ROLLBACK/);
  assert.match(source, /release_sha:/);
  assert.match(source, /branch_name:/);
  assert.match(source, /backup-before-production-/);
  assert.match(source, /withered-lab-08522436/);
  assert.match(source, /Authorization: Bearer/);
  assert.match(source, /--request POST/);
  assert.match(source, /protected: true/);
  assert.match(source, /parent_id/);
  assert.match(source, /annotation_value/);
  assert.match(source, /release_sha/);
  assert.match(source, /compute endpoint created:.*no/);
  assert.match(source, /Production Rollback Point Verification next/);
  assert.doesNotMatch(source, /endpoints:/);
  assert.doesNotMatch(source, /--request DELETE|--request PUT|--request PATCH/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
  assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL/);
});


test('Production Neon API access check is read-only and scoped to the Production project', () => {
  const path = '.github/workflows/production-neon-api-access-check.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /withered-lab-08522436/);
  assert.match(source, /secrets\.NEON_API_KEY/);
  assert.match(source, /console\.neon\.tech\/api\/v2\/auth/);
  assert.match(source, /projects\/\$\{PROJECT_ID\}\/branches/);
  assert.match(source, /include_deleted=false/);
  assert.match(source, /\.default == true/);
  assert.match(source, /read-only/);
  assert.match(source, /GET requests only/);
  assert.doesNotMatch(source, /--request POST|--request PATCH|--request DELETE|--request PUT/);
  assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
});


test('Production pre-execution self-check validates secret presence and Production identities without mutation', () => {
  const path = '.github/workflows/production-pre-execution-self-check.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /secrets\.NEON_API_KEY/);
  assert.match(source, /secrets\.PRODUCTION_DATABASE_URL/);
  assert.match(source, /secrets\.PRODUCTION_DATABASE_URL_UNPOOLED/);
  assert.match(source, /withered-lab-08522436/);
  assert.match(source, /plain-dawn-64792117/);
  assert.match(source, /ep-billowing-smoke-ah3grpmy-pooler\.c-3\.us-east-1\.aws\.neon\.tech/);
  assert.match(source, /neondb/);
  assert.match(source, /pooled and unpooled hosts must differ/);
  assert.match(source, /Production pre-execution self-check: PASS/);
  assert.match(source, /read-only/);
  assert.doesNotMatch(source, /--request POST|--request PATCH|--request DELETE|--request PUT/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
  assert.doesNotMatch(source, /INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|ALTER\s+|DROP\s+|CREATE\s+/i);
});


test('Production health endpoint exposes only release and DB health signals', () => {
  const path = 'src/app/api/health/route.ts';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(source, /prisma\.\$queryRaw`SELECT 1`/);
  assert.match(source, /status: 'ok'/);
  assert.match(source, /database: 'ok'/);
  assert.match(source, /status: 'degraded'/);
  assert.match(source, /database: 'unavailable'/);
  assert.match(source, /Cache-Control/);
  assert.doesNotMatch(source, /error\.message|stack|DATABASE_URL|POSTGRES_/);
});

test('Production post-deploy smoke binds observed runtime to the approved release SHA', () => {
  const path = '.github/workflows/production-post-deploy-smoke.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /release_sha:/);
  assert.match(source, /deploy_readiness_run_id:/);
  assert.match(source, /production-deploy-readiness\.yml/);
  assert.match(source, /https:\/\/x-clone-olive-chi\.vercel\.app/);
  assert.match(source, /\/api\/health/);
  assert.match(source, /releaseSha/);
  assert.match(source, /\/api\/feed\?page=1/);
  assert.match(source, /Verify health remains stable/);
  assert.match(source, /read-only HTTP checks only/);
  assert.doesNotMatch(source, /vercel deploy|deploy_to_vercel/i);
  assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL/);
});


test('Production deploy readiness accepts same-SHA manual CI for docs-only main commits', () => {
  const path = '.github/workflows/production-deploy-readiness.yml';
  const source = readFileSync(path, 'utf8');

  assert.match(source, /push,workflow_dispatch/);
  assert.match(source, /allowed_events/);
  assert.match(source, /security-integration-ci\.yml/);
  assert.match(source, /e2e\.yml/);
  assert.match(source, /head_sha/);
  assert.match(source, /RELEASE_SHA/);
});


test('Production Vercel candidate verification binds a READY Preview deployment to the exact main SHA', () => {
  const path = '.github/workflows/production-vercel-candidate-verify.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /release_sha:/);
  assert.match(source, /deployment_id:/);
  assert.match(source, /secrets\.VERCEL_TOKEN/);
  assert.match(source, /team_P1Z1wvYF1h42LIl0YfgXoOPI/);
  assert.match(source, /prj_AcjmJFO5jcqse6sStknZzZkmfR7h/);
  assert.match(source, /api\.vercel\.com\/v7\/deployments/);
  assert.match(source, /sha=\$\{RELEASE_SHA\}/);
  assert.match(source, /state=READY/);
  assert.match(source, /Candidate is already a Production-target deployment/);
  assert.match(source, /api\.vercel\.com\/v13\/deployments/);
  assert.match(source, /read-only and does not promote or deploy anything/);
  assert.doesNotMatch(source, /--request POST|--request PATCH|--request DELETE|--request PUT/);
});

test('Production Vercel promotion is manual and requires both candidate and deploy readiness attestations', () => {
  const path = '.github/workflows/production-vercel-promote.yml';
  assert.equal(existsSync(path), true);
  if (!existsSync(path)) return;

  const source = readFileSync(path, 'utf8');

  assert.match(source, /workflow_dispatch/);
  assert.match(source, /PROMOTE_COCO_PRODUCTION/);
  assert.match(source, /candidate_verification_run_id:/);
  assert.match(source, /deploy_readiness_run_id:/);
  assert.match(source, /production-vercel-candidate-verify\.yml/);
  assert.match(source, /production-deploy-readiness\.yml/);
  assert.match(source, /Production candidate verify \$\{DEPLOYMENT_ID\}/);
  assert.match(source, /api\.vercel\.com\/v10\/projects\/\$\{PROJECT_ID\}\/promote\/\$\{DEPLOYMENT_ID\}/);
  assert.match(source, /201\|202/);
  assert.match(source, /Run Production Post-deploy Smoke immediately/);
  assert.doesNotMatch(source, /prisma migrate deploy/);
  assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL/);
});

test('Production deploy readiness also requires a verified Vercel promotion candidate', () => {
  const path = '.github/workflows/production-deploy-readiness.yml';
  const source = readFileSync(path, 'utf8');

  assert.match(source, /candidate_verification_run_id:/);
  assert.match(source, /CANDIDATE_VERIFICATION_RUN_ID/);
  assert.match(source, /production-vercel-candidate-verify\.yml/);
  assert.match(source, /Vercel promotion candidate: verified/);
});

test('Production post-deploy smoke is bound to the exact successful promotion run', () => {
  const path = '.github/workflows/production-post-deploy-smoke.yml';
  const source = readFileSync(path, 'utf8');

  assert.match(source, /deployment_id:/);
  assert.match(source, /promotion_run_id:/);
  assert.match(source, /PROMOTION_RUN_ID/);
  assert.match(source, /production-vercel-promote\.yml/);
  assert.match(source, /Production promote \$\{DEPLOYMENT_ID\}/);
  assert.match(source, /promoted deployment ID/);
});
