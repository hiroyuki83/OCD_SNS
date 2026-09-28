# CoCo Production Release Runbook

最終更新: 2026-09-28

## 目的

`main` への統合と Production release を明確に分離し、Production DB / Vercel Production への変更を明示承認後にのみ実施する。

現在の状態:

- main: Sanction + Sanction Appeal 統合済み
- main: Production preflight safetyまで統合済み
- latest Production-safety merge commit: `0b39d89c5957df7d66fb4c2cc83aea909d82cc3e`
- shared Preview DB: 41 migrations
- Preview Sanction / Appeal schema: verified
- Preview HTTP smoke: 6 / 6 PASS
- Preview runtime error/fatal: 0
- main Security CI: 182 / 182 PASS
- main Playwright: 16 / 16 PASS
- Vercel `main` auto-deploy: disabled
- Production DB migration: not started
- new Production deployment: not started

Production release remains **HOLD** until explicit approval.

## 0. Observed current Production state

Read-only investigation on 2026-09-28 identified the currently aliased Vercel Production deployment.

- deployment ID: `dpl_8U7SN8AU6fonvRq7fYsALJGwAzCb`
- target: `production`
- Git ref: `main`
- deployed commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- deployment created: **2026-09-26 18:58 JST**
- aliases:
  - `x-clone-olive-chi.vercel.app`
  - `coco-hiroyuki-desperado-yahoocojps-projects.vercel.app`
  - `coco-git-main-hiroyuki-desperado-yahoocojps-projects.vercel.app`
- current `main` is **1215 commits ahead** of the deployed Production commit
- migration directories at deployed commit: **28**
- migration directories on current main: **41**
- potential maximum migration delta if Production DB matches deployed code history: **13**
- actual Production `_prisma_migrations` remains **unread / unknown**

Read-only smoke against the current Production alias:

- `/`: 200
- `/login`: 200
- `/explore`: 200
- `/safety`: 200
- `/api/feed?page=1`: 200 / DB-backed response
- `/api/search-posts?q=test`: 200 / DB-backed response

Runtime scan immediately after smoke:

- application 5xx observed: **0**
- DB/schema exception observed: **0**
- warning: pg connection-string SSL mode compatibility warning
- Production app can currently serve DB-backed reads

Configuration-history note:

- a pre-existing Vercel `DATABASE_URL` scoped to **All Environments** existed before the dedicated Preview DB was created
- Preview was later separated through `PREVIEW_DATABASE_URL`
- the actual target of the pre-existing `DATABASE_URL` has **not been verified**
- therefore it must not be assumed to be either the shared Preview DB or any particular Neon project

The connected Vercel tool currently does not expose Production environment-variable values, and its project-detail endpoint is currently unusable because of an argument-schema mismatch. Production DB identity therefore remains unresolved.

## 1. Production identity gate

Before any write:

1. Identify the actual Production Neon project / branch / database.
2. Confirm it is not the shared Preview project `coco-preview`.
3. Record:
   - project ID
   - branch ID
   - database name
   - direct endpoint host for migration
   - pooled endpoint host for application runtime
4. Read `_prisma_migrations` only.
5. Compare Production migration history with `prisma/migrations` on `main`.
6. Do not infer the Production migration count from Preview.

Stop immediately if the Production identity is ambiguous.

## 2. Pre-release backup gate

Before migration:

1. Confirm Neon point-in-time restore/history is available.
2. Create a named Production rollback point immediately before migration.
3. Record branch/snapshot ID and creation timestamp.
4. Verify the rollback point is READY.
5. Do not delete existing Preview rollback branches as part of Production migration.

Suggested name:

`backup-before-production-release-2026-09-28`

## 3. Migration plan gate

詳細な13 migration監査は `PRODUCTION_MIGRATION_AUDIT_2026-09-28.md` を正本とする。

Use the migration files committed to `main` as the source of truth.

Current latest migrations:

- `20260928071000_add_sanction_records`
- `20260928110500_add_sanction_appeals`

Which migrations are pending in Production must be determined from Production `_prisma_migrations`; never assume both are pending.

Before applying:

- inspect each pending migration SQL
- verify no unexpected destructive statement
- verify foreign-key targets exist
- verify required enums / tables do not already exist outside Prisma history
- verify migration order
- use a direct/unpooled Neon connection for schema migration

If schema state and Prisma history disagree, stop and reconcile manually.


## 3A. Production compatibility audit

The currently deployed Production application was built from commit
`1c57373d476a904942d4509354dfa3723d6192aa`, whose repository state contains
28 Prisma migrations.

Current `main` contains 41 migrations. If the actual Production migration
history matches the deployed commit, the apparent delta is 13 migrations.
The real delta must still be determined from Production `_prisma_migrations`.

### Migration compatibility classification

The apparent 13 migrations are classified as follows:

1. `20260926103000_add_restriction_until` — additive nullable column
2. `20260926104500_add_warning_appeal` — additive table / indexes / FKs
3. `20260926111500_add_appeal_review` — additive enum / columns / indexes / FK
4. `20260926120000_add_session_version` — additive column with default
5. `20260926123000_add_staff_totp` — additive nullable columns
6. `20260926124500_add_staff_recovery_codes` — additive table / indexes / FK
7. `20260927002000_add_follow_approval` — additive column + existing-row backfill + indexes
8. `20260928013000_remove_reply_and_quote_post` — **destructive / compatibility boundary**
9. `20260928014500_add_post_image_alt` — additive nullable column
10. `20260928023000_add_notification_preferences` — additive columns with defaults
11. `20260928031500_add_email_change_pending` — additive nullable column
12. `20260928071000_add_sanction_records` — additive enums / table / indexes / FKs
13. `20260928110500_add_sanction_appeals` — additive enum / table / indexes / FKs

Migration 8 drops:

- `Reply`
- `Post.quotePostId`
- the quote-post foreign key

The currently deployed Production Prisma Client still models Reply / Quote.
Old Production code includes ordinary Prisma queries that return all Post scalar
fields, so dropping `quotePostId` while that deployment is still serving traffic
can produce a missing-column runtime failure.

Conversely, current `main` expects columns/tables from later migrations and
cannot safely be deployed against the current old schema before migrations.

Therefore **do not run all pending migrations in one batch while the old
Production deployment remains live.**

## 3B. Staged Production release strategy

A compatible historical bridge state exists at:

`64d5ad3fbc4e09f87ba8a09fdd75a9f823bccda1`
(`schema: remove reply and quote post models`)

Properties of this bridge candidate:

- migration files present: **35**
- Prisma schema no longer contains `Reply`
- Prisma schema no longer contains `Post.quotePostId`
- requires the additive migrations through `20260927002000_add_follow_approval`
- does **not** require imageAlt, notification-preference, pending-email, Sanction,
  or Appeal migrations
- a DB that still contains legacy Reply / Quote storage is compatible because
  extra tables/columns are ignored by the newer Prisma Client
- after the destructive Reply / Quote migration, the same bridge application
  remains compatible

The intended staged sequence, subject to actual Production migration history, is:

### Stage A — additive DB preparation

1. identify Production DB and read actual migration history
2. create Production rollback point
3. create a temporary Neon branch from the exact Production state
4. validate only the migrations needed to reach migration count/state 35
5. apply those additive migrations to Production
6. verify old Production deployment still serves DB-backed reads

Do **not** apply `20260928013000_remove_reply_and_quote_post` in Stage A.

### Stage B — bridge application

1. validate bridge source `64d5ad3f...` against a DB at Stage-A schema
2. deploy the validated bridge application to Production
3. smoke public + DB-backed reads
4. scan runtime errors
5. confirm the bridge no longer depends on Reply / Quote storage

Only after the bridge is healthy may the destructive migration run.

### Stage C — remaining DB migrations

With the bridge application serving traffic:

1. apply `20260928013000_remove_reply_and_quote_post`
2. apply the remaining additive migrations through
   `20260928110500_add_sanction_appeals`
3. verify migration history and final schema
4. confirm the bridge remains healthy

### Stage D — current main application

1. deploy the intended current `main` commit explicitly
2. run post-deploy public and authenticated smoke
3. scan Production runtime errors / 5xx
4. record final deployment and migration state

### Stop conditions

Stop before each next stage if:

- actual Production migration history differs from the assumed 28-migration baseline
- Production DB identity is ambiguous
- Stage-A migration dry run fails
- bridge validation fails
- bridge Production smoke fails
- destructive migration dry run fails
- runtime errors indicate schema mismatch
- rollback path is not READY

This staged strategy replaces a simple “migrate everything, then deploy” sequence.


## 4. Migration dry run

Before applying to Production:

1. Create a temporary branch from the exact Production state.
2. Apply only the migrations for the current staged release boundary; never cross the destructive Reply / Quote boundary before the bridge application is deployed.
3. Run schema verification.
4. Confirm existing row counts for critical tables are unchanged unless migration intentionally changes them.
5. Smoke insert/update/delete for new Sanction / Appeal schema if relevant.
6. Delete the temporary migration branch after verification.

Production itself remains unchanged during this step.

## 5. Production migration

Requires explicit user approval immediately before execution.

Execution:

1. Re-check Production identity.
2. Re-check rollback point.
3. Re-check Production migration history.
4. Apply only the migrations authorized for the current stage; do not collapse Stage A and Stage C into one migration batch.
5. Confirm `_prisma_migrations` records every applied migration as finished and not rolled back.
6. Verify expected schema, indexes and foreign keys.

Do not run Preview seed against Production.

## 6. Production deployment

Production環境変数監査は `PRODUCTION_ENV_AUDIT_2026-09-28.md` を正本とする。

Requires explicit user approval after DB migration succeeds.

Preconditions:

- Production DB migration succeeded
- Production migration history verified after migration
- main CI / E2E green
- `main` auto-deploy remains disabled
- intended main commit is recorded
- Production environment variables point to the Production DB, not shared Preview

Deploy the intended main commit explicitly.

Do not enable permanent automatic Production deployment as part of the release.

## 7. Post-deploy smoke

Immediately after Production deploy:

Public:

- `/`
- `/login`
- `/register`
- `/explore`
- `/safety`
- `/appeal`

Authenticated representative checks:

- login
- feed read
- create post
- reaction / bookmark
- private visibility
- block / mute
- moderator/admin authorization
- warning / sanction history
- Sanction Appeal route
- psychological self-test privacy

Use disposable Production test accounts only where the operation changes data.

## 8. Runtime error gate

After smoke:

- scan Vercel Production runtime logs
- check error/fatal entries
- inspect 5xx responses
- verify no Prisma schema mismatch
- verify no auth/session failure spike

If a serious error appears, stop release progression.

## 9. Rollback decision

Application-only fault:

- rollback deployment first
- do not restore DB unless data/schema damage requires it

Migration/data fault:

1. stop further writes where feasible
2. inspect rollback branch/snapshot
3. determine whether forward-fix or restore is safer
4. restore only with explicit approval
5. repeat smoke and runtime verification

## 10. Completion record

A Production release is complete only when all are recorded:

- released main commit
- Production DB identity
- pre-release rollback point
- migrations applied
- migration history after release
- Vercel Production deployment ID
- smoke results
- runtime error scan result
- rollback not required / rollback details
- release timestamp

## Current gate

**NEXT-039: IN PROGRESS — runbook + guarded read-only preflight merged; current Production deployment identified; Production DB identity unresolved; backup + migration dry run not started.**

**NEXT-040: HOLD.**

No Production write or deployment is authorized by this document itself.


## Current Production baseline (2026-09-28)

### Vercel Production

Current latest Production deployment:

- deployment: `dpl_8U7SN8AU6fonvRq7fYsALJGwAzCb`
- commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- branch: `main`
- aliases:
  - `x-clone-olive-chi.vercel.app`
  - `coco-hiroyuki-desperado-yahoocojps-projects.vercel.app`
  - `coco-git-main-hiroyuki-desperado-yahoocojps-projects.vercel.app`
- state: READY

Current public baseline:

- `/`: 200
- `/login`: 200
- `/register`: 200
- `/explore`: 200
- `/safety`: 200
- `/appeal`: 404

`/appeal` 404 is expected for the currently deployed pre-Sanction-Appeal commit.

Database-backed public API baseline:

- `/api/feed?limit=1`: 200
- response: valid JSON
- Production DB connectivity through the deployed app: confirmed

Recent Production runtime scan after baseline requests:

- fatal errors: none observed
- application 5xx: none observed
- PostgreSQL client SSL compatibility warning observed
- warning recommends explicit `sslmode=verify-full` before a future pg major-version change

### Preview / Production separation evidence

The shared Preview DB contains these known seed handles:

- `preview-admin`
- `preview-moderator`
- `preview-private`
- `preview-public-1`
- `preview-public-2`

All five returned 404 from the Production `/api/user-handle?handle=...` endpoint while they exist in the shared Preview database.

This is strong operational evidence that current Production is **not connected to the shared Preview DB**.

It does not replace the Production identity gate. Exact Production DB host / database name must still be identified before any migration write.

### Production code migration baseline

The currently deployed Production commit contains **28 Prisma migrations**.
Its latest migration is:

- `20260926101500_add_warning_read_state`

Current `main` contains **41 Prisma migrations**.

There are 13 migration files present on `main` but absent from the currently deployed Production commit:

1. `20260926103000_add_restriction_until`
2. `20260926104500_add_warning_appeal`
3. `20260926111500_add_appeal_review`
4. `20260926120000_add_session_version`
5. `20260926123000_add_staff_totp`
6. `20260926124500_add_staff_recovery_codes`
7. `20260927002000_add_follow_approval`
8. `20260928013000_remove_reply_and_quote_post`
9. `20260928014500_add_post_image_alt`
10. `20260928023000_add_notification_preferences`
11. `20260928031500_add_email_change_pending`
12. `20260928071000_add_sanction_records`
13. `20260928110500_add_sanction_appeals`

These are **candidate Production-pending migrations only**.

Do not assume the Production DB has exactly 28 applied migrations. The actual `_prisma_migrations` table remains the source of truth and must be read before migration planning is finalized.

### Production DB identity status

- exact Neon project: unresolved
- exact Neon branch: unresolved
- exact endpoint host: unresolved
- exact database name: unresolved
- shared Preview DB exclusion: supported by public-data separation check
- Production DB write authorization: not granted

The connected Vercel tool does not expose Production environment variable values, so Production DB identity cannot be safely inferred from the current connector.

The release remains **HOLD** until the exact Production DB identity is supplied or retrieved through an authorized environment-variable path and the read-only `production:db:preflight` command succeeds.


## Production migration stop conditions

Production identity取得後、以下のどれかに該当したらmigration実行へ進まない。

- `_prisma_migrations` にmainに存在しないmigrationがある
- unfinished / rolled-back migrationがある
- schemaとmigration historyが一致しない
- `Reply` rowが1件以上ある
- `Post.quotePostId` 非NULLが1件以上ある
- Follow件数またはdry-run lock時間が許容範囲を超える
- exact Production host / DB名が承認値と一致しない
- known shared Preview hostへ接続している
- pre-release rollback pointがREADYでない

上記が全て解消されるまでProduction migrationはHOLD。


## Production build / migration separation

Production Vercel build no longer runs `prisma migrate deploy`.

`scripts/vercel-build.mjs` now:

1. validates required Production environment variables
2. validates `STAFF_MFA_ENCRYPTION_KEY`
3. runs Prisma generate
4. runs Next.js build

It does **not** mutate the database.

Operational consequence:

- Production migration is a separate explicit step
- Production deployment cannot implicitly apply pending Prisma migrations
- DB identity / backup / dry run / explicit migration approval remain mandatory
- deploy approval and migration approval are distinct gates
- if application code requires schema not yet present, deploy must not start until the migration gate is complete


## Production DB identity confirmed by Vercel configuration

Confirmed from Vercel Environment Variables on 2026-09-28:

- Neon project ID: `withered-lab-08522436`
- PostgreSQL host: `ep-billowing-smoke-ah3grpmy-pooler.c-3.us-east-1.aws.neon.tech`
- database: `neondb`

This identity is distinct from shared Preview:

- Preview project ID: `plain-dawn-64792117`
- Preview project name: `coco-preview`
- Preview region: `aws-ap-southeast-1`

The currently connected Neon connector can read the Preview project but returns an authorization/404 error for `withered-lab-08522436`.

Therefore:

- Production identity values are known
- Production DB connectivity through the deployed app is confirmed
- direct Neon read-only inspection is still blocked by connector authorization
- no Production SQL write has been attempted
- no Production backup / migration / deploy has been started

Next safe action: connect or authorize the Neon account/organization that owns `withered-lab-08522436`, then run the read-only Production preflight.


## Manual read-only preflight via GitHub Actions

Use this path when the connected Neon OAuth cannot directly inspect the Vercel-managed Production project.

### One-time secret setup

In GitHub:

1. Open `hiroyuki83/OCD_SNS`
2. Settings
3. Secrets and variables
4. Actions
5. New repository secret
6. Name: `PRODUCTION_DATABASE_URL`
7. Value: copy the existing Vercel **Production** `POSTGRES_PRISMA_URL` value exactly (use `DATABASE_URL` only if it exists and points to the same confirmed pooler host)
8. Save

Do not paste the connection string into chat, issues, PRs, commits, workflow YAML, or docs.

The workflow hard-codes only these confirmed non-secret identity values:

- host: `ep-billowing-smoke-ah3grpmy-pooler.c-3.us-east-1.aws.neon.tech`
- database: `neondb`

The secret itself remains only in GitHub Actions.

For this read-only preflight, `POSTGRES_PRISMA_URL` is preferred because the confirmed Production host is the pooled Neon endpoint. A later migration execution must use a separately verified direct/unpooled connection.

### Run

In GitHub:

1. Actions
2. `Production DB Read-only Preflight`
3. Run workflow
4. Branch: `main`
5. Run workflow

The workflow is `workflow_dispatch` only.

It performs:

- no migration
- no DDL
- no INSERT / UPDATE / DELETE
- no Vercel deployment
- no Production alias change

It runs `npm run production:db:preflight` only.

### Expected report

The log reports:

- Production hostname / database identity
- local migration count
- actual applied Production migration count
- actual pending migration names
- User row count
- Post row count
- Follow row count
- Reply row count if the table exists
- quoted Post count if `quotePostId` exists
- staff TOTP schema signature
- Sanction / Appeal table presence
- destructive Reply/Quote removal block status

### Automatic stop conditions

The preflight fails without writing anything if:

- URL host differs from the approved Production host
- database name differs from `neondb`
- URL is the known shared Preview host
- migration history is incomplete / rolled back
- Production contains migration names absent from main
- recorded migration history disagrees with schema
- Reply rows exist
- non-null quotePostId rows exist

A failed preflight is a safe stop, not a reason to run migration manually.


## Actual Production DB preflight result (2026-09-28)

GitHub Actions `Production DB Read-only Preflight` run `36408876898`, attempt 3.

Connection identity:

- host: `ep-billowing-smoke-ah3grpmy-pooler.c-3.us-east-1.aws.neon.tech`
- database: `neondb`
- secret was consumed only by GitHub Actions
- DB writes: **0**

Migration state:

- local/main migrations: **41**
- Production `_prisma_migrations` rows: **28**
- Production applied migrations: **27**
- actual pending main migrations: **15**

Pending:

1. `20260926100000_add_moderation_warning`
2. `20260926101500_add_warning_read_state`
3. `20260926103000_add_restriction_until`
4. `20260926104500_add_warning_appeal`
5. `20260926111500_add_appeal_review`
6. `20260926120000_add_session_version`
7. `20260926123000_add_staff_totp`
8. `20260926124500_add_staff_recovery_codes`
9. `20260927002000_add_follow_approval`
10. `20260928013000_remove_reply_and_quote_post`
11. `20260928014500_add_post_image_alt`
12. `20260928023000_add_notification_preferences`
13. `20260928031500_add_email_change_pending`
14. `20260928071000_add_sanction_records`
15. `20260928110500_add_sanction_appeals`

Migration history anomaly:

- `20260124133259_init`
  - state: ROLLED_BACK
  - finishedAt: null
  - rolledBackAt: 2026-07-06T01:31:12.807Z
  - appliedStepsCount: 0
- applied migration not present on current main:
  - `20260926073000_add_moderation_actions_and_appeals`

Production data counts:

- User: **2**
- Post: **3**
- Follow: **1**
- Reply: **0**
- Post with non-null `quotePostId`: **0**

Current schema signatures:

- `User.staffTotpSecretEncrypted`: absent
- `Reply` table: present
- `Post.quotePostId`: present
- `Sanction` table: absent
- `Appeal` table: **present**

Destructive Reply/Quote removal data gate:

- **CLEAR**
- no Reply or Quote rows would be deleted based on current counts

Current blockers:

1. historical rolled-back migration needs classification/reconciliation
2. applied unknown migration `20260926073000_add_moderation_actions_and_appeals` needs schema reconciliation
3. pre-existing `Appeal` table must be identified before `20260928110500_add_sanction_appeals`; blindly applying that migration would risk an object-name collision

Do not run `prisma migrate deploy` against Production until these blockers are resolved and a clone/dry-run succeeds.


## Legacy moderation reconciliation dry-run result

Actual Production read-only diagnostics identified an applied legacy migration that is not present on current main:

- `20260926073000_add_moderation_actions_and_appeals`

It created:

- `ModerationAction`
- legacy `Appeal`
- legacy `AppealStatus`
- `ModerationActionType`
- `NotificationType.MODERATION`
- `User.restrictionUntil`

Current Production data counts relevant to reconciliation are all safe for guarded removal:

- ModerationAction rows: 0
- legacy Appeal rows: 0
- MODERATION Notification rows: 0
- users with restrictionUntil: 0
- Reply rows: 0
- Quote rows: 0

Guarded reconciliation source:

- `scripts/production-legacy-moderation-reconcile.sql`

Isolated workflow:

- `.github/workflows/production-reconciliation-dry-run.yml`

Successful dry run:

- run `36427568122`
- result: **SUCCESS**

The dry run proved the full sequence from the reproduced legacy Production state to current main:

- legacy/current mismatch is detected
- obsolete empty legacy moderation objects are removed transactionally
- legacy migration history is retained and marked rolled back
- the already-present restrictionUntil migration is resolved as applied
- remaining current migrations apply successfully
- final read-only Production preflight passes

This dry-run success is necessary but does **not** authorize Production writes.

Before Production reconciliation:

1. create and verify a rollback point
2. use a separately verified direct/unpooled Production connection
3. run current read-only preflight again
4. compare all guard counts to the accepted baseline
5. obtain explicit approval for Production write


## Guarded Production reconciliation apply workflow

Implementation:

- `.github/workflows/production-reconciliation-apply.yml`
- `scripts/production-reconciliation-precheck.ts`

The workflow is manual only and does not deploy Vercel.

Required inputs:

- confirmation: `APPLY_COCO_PRODUCTION_RECONCILIATION`
- rollback point identifier
- exact current main SHA
- exact direct/unpooled Production hostname

Required GitHub Secret:

- `PRODUCTION_DATABASE_URL_UNPOOLED`

Do not use the pooled `POSTGRES_PRISMA_URL` for the Production migration write.

The workflow refuses a hostname containing `-pooler.` and validates the URL host/database through the Production migration safety layer.

Before any write, the precheck requires the current Production state to still match the accepted legacy baseline and all live-data counts relevant to schema removal to remain zero.

The workflow then performs only the DB reconciliation/migration sequence. It does not trigger or promote a Production Vercel deployment.

The presence of this workflow does not authorize its execution.


## Staged workflow implementation status — 2026-09-28

The staged release strategy is now represented directly in GitHub Actions.

### Stage A — pre-bridge additive DB preparation

Workflows:

- `.github/workflows/production-stage-a-dry-run.yml`
- `.github/workflows/production-stage-a-apply.yml`

Verifier:

- `scripts/production-stage-a-verify.ts`

Stage A intentionally stops after:

- `20260927002000_add_follow_approval`

It must leave the following migration pending:

- `20260928013000_remove_reply_and_quote_post`

The Production Stage A apply workflow is manual-only and requires:

- exact confirmation
- exact main release SHA
- verified rollback point identifier
- direct / unpooled Production DB hostname
- successful Production read-only preflight attestation
- successful Stage A dry-run attestation

### Stage B — bridge compatibility gate

Workflow:

- `.github/workflows/production-bridge-validation.yml`

Approved bridge commit:

- `64d5ad3fbc4e09f87ba8a09fdd75a9f823bccda1`

The isolated validation reproduces Stage A, builds the historical bridge against that DB state, starts it, and smokes public + DB-backed routes.

Actual Production bridge deployment remains a separate explicit approval step.

### Stage C — destructive boundary + remaining migrations

Workflows:

- `.github/workflows/production-stage-c-dry-run.yml`
- `.github/workflows/production-stage-c-apply.yml`

Precheck:

- `scripts/production-stage-c-precheck.ts`

Stage C requires:

- successful Stage A Apply run for the exact release SHA
- successful Production read-only preflight after Stage A
- successful Stage C dry run
- successful bridge compatibility validation
- exact approved bridge commit
- explicit bridge Production smoke confirmation
- verified Stage C rollback point
- Reply rows = 0
- quoted Post rows = 0

The old monolithic workflow:

- `.github/workflows/production-reconciliation-apply.yml`

is now intentionally blocked and deprecated. It must not be used as an alternate release path.

### Stage D — current main compatibility validation

Workflow:

- `.github/workflows/production-final-validation.yml`

The workflow reproduces the complete historical migration path through Stage A and Stage C, then:

- requires final Production-schema preflight PASS
- builds current main
- starts current main
- smokes public routes
- smokes a DB-backed feed route

Actual current-main Production deployment remains a separate explicit approval step.

### Current safety state

All workflows above are preparation / validation mechanisms.

They do not constitute authorization to mutate Production or deploy Production.

As of this update:

- Production DB write: **not performed**
- Production Stage A apply: **not performed**
- Production bridge deploy: **not performed**
- Production Stage C apply: **not performed**
- current main Production deploy: **not performed**

Production execution remains **HOLD** until explicit approval at each write/deploy boundary.


## Production rollback point verification

Workflow:

- `.github/workflows/production-rollback-point-verify.yml`

Required GitHub Actions secret:

- `NEON_API_KEY`

Use a Neon API key that can read Production project:

- `withered-lab-08522436`

The workflow is read-only and verifies the rollback branch through the Neon Management API.

Required inputs:

- rollback branch ID (`br-...`)
- exact rollback branch name
- maximum accepted branch age in minutes

The verification requires:

- branch exists in the Production project
- branch is active
- branch is not the default branch
- branch is a direct child of the Production default branch
- exact branch name matches
- branch creation timestamp is within the accepted freshness window

The workflow run name includes the verified branch ID:

`Production rollback verify <branch-id>`

Both Production write workflows now require the successful rollback verification run ID:

- `Production Stage A Apply`
- `Production Stage C Apply`

The apply workflow verifies:

- rollback-verification workflow succeeded
- verification run belongs to the exact release SHA
- run was manually dispatched
- referenced workflow path is correct
- verified branch ID matches the rollback branch supplied to the write workflow

Do not place `NEON_API_KEY` in workflow YAML, commits, issues, PR descriptions, or chat.

The rollback verification workflow does not create, restore, modify, or delete Neon branches.
