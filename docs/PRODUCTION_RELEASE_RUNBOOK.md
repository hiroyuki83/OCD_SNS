# CoCo Production Release Runbook

最終更新: 2026-09-28

## 目的

`main` への統合と Production release を明確に分離し、Production DB / Vercel Production への変更を明示承認後にのみ実施する。

現在の状態:

- main: Sanction + Sanction Appeal 統合済み
- main merge commit: `fc935925c4bb0e11630063eb83839f69ee68bc2b`
- shared Preview DB: 41 migrations
- Preview Sanction / Appeal schema: verified
- Preview HTTP smoke: 6 / 6 PASS
- Preview runtime error/fatal: 0
- main Security CI: 173 / 173 PASS
- main Playwright: 16 / 16 PASS
- Vercel `main` auto-deploy: disabled
- Production DB migration: not started
- Production deployment: not started

Production release remains **HOLD** until explicit approval.

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

## 4. Migration dry run

Before applying to Production:

1. Create a temporary branch from the exact Production state.
2. Apply only the Production-pending Prisma migrations.
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
4. Apply pending Prisma migrations only.
5. Confirm `_prisma_migrations` records every applied migration as finished and not rolled back.
6. Verify expected schema, indexes and foreign keys.

Do not run Preview seed against Production.

## 6. Production deployment

Requires explicit user approval after DB migration succeeds.

Preconditions:

- Production DB migration succeeded
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

**NEXT-039: plan ready / Production identity + backup + migration dry run not started.**

**NEXT-040: HOLD.**

No Production write or deployment is authorized by this document itself.
