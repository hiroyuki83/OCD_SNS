# CoCo Production Environment Audit

最終更新: 2026-10-02

比較対象:

- current Production deployed commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- current main

この文書はProduction release前の環境変数監査。
秘密値そのものは記録しない。

## Build-blocking Production variables

Current mainの `scripts/vercel-build.mjs` は `VERCEL_ENV=production` の場合、以下を必須としている。

### DATABASE_URL

- 必須
- Production DB接続先
- Production identity gateの正本になる
- shared Preview DB URLを使用してはならない

### AUTH_SECRET / NEXTAUTH_SECRET

- `AUTH_SECRET` またはlegacy `NEXTAUTH_SECRET` のどちらかが必須
- 現Production commitにも認証secretは必要だったため、新規要件ではない

### STAFF_MFA_ENCRYPTION_KEY

- **current Production commitには存在しなかった新規Production必須env**
- base64-encoded 32-byte key
- Production build時に長さとbase64妥当性を検証
- 未設定・不正形式ならbuildを停止
- staff TOTP secretのAES-256-GCM暗号化に使用
- 一度Productionでstaff TOTPを使い始めた後に値を変更すると、既存secretを復号できなくなるため固定運用が必要

Production release前の必須確認:

- Vercel Production Environmentに設定済み
- 32-byte keyをbase64化した値
- Preview/E2E用keyと共有しない
- release後に不用意にrotationしない

## Feature-required variables

### RESEND_API_KEY + EMAIL_FROM

current Production commitでも使用。

以下のtransactional email機能に必要:

- email verification
- password reset
- email change
- moderation / appeal result email

未設定時、buildは必ずしも停止しないが、メール依存機能は正常運用できない。

### BLOB_READ_WRITE_TOKEN

current Production commitでも使用。

画像uploadをProductionで利用する場合に必要。
build自体の必須値ではない。

## Preview / test-only variables

Productionへ流用しない。

- `PREVIEW_DATABASE_URL`
- `PREVIEW_SEED_USERS`
- `PREVIEW_TEST_PASSWORD`
- `E2E_EMAIL_MODE`
- `E2E_EMAIL_OUTBOX_FILE`
- `E2E_BLOB_MODE`

Mainの実装ではE2E email/blob modeは `VERCEL_ENV=production` の場合に無効化される。

## Important build behavior

Current mainの `scripts/vercel-build.mjs` はProduction buildで:

1. `DATABASE_URL` を要求
2. auth secretを要求
3. `STAFF_MFA_ENCRYPTION_KEY` を要求・検証
4. Prisma generate
5. Next.js build

Production buildは **`prisma migrate deploy` を実行しない**。

これによりDB migrationとapplication deploymentを独立した承認ゲートとして運用できる。

安全運用:

- Production DB identity / preflightを先に完了
- rollback pointを作る
- destructive migration gateを解消
- migration dry runを通す
- 明示承認後にProduction migrationを独立実行
- migration historyとschemaを確認
- その後に別承認でProduction deploymentを実行
- schema未適用の状態で新applicationをdeployしない

## SSL mode

Current Production runtimeではPostgreSQL clientから以下のcompatibility warningを確認済み。

- `sslmode=require/prefer/verify-ca` の将来の意味変更warning

Mainの `normalizePostgresSslMode` は:

- require
- prefer
- verify-ca

を `verify-full` へ正規化する。

したがってmain release後は現在のSSL warningが解消することをpost-deploy runtime scanで確認する。

## Permanent Vercel release path

2026-10-02のProduction releaseで、Preview deploymentをVercel Promote APIへ直接渡す経路はHTTP 422となった。
そのため今後はPreview artifactを検証専用とし、Production traffic切替には別途Production-target artifactを作成する。

正式なapplication deployment順序:

1. Preview deploymentを作成し、Production Vercel Candidate Verificationでread-only検証
2. Production Deploy Readinessを完了
3. Production Current Main Vercel Stageを明示承認で実行
   - exact current mainをcheckout
   - `scripts/vercel-build.mjs` に `prisma migrate deploy` がないことを確認
   - `vercel deploy --prod --skip-domain` でProduction-target artifactを作成
   - canonical Production aliasが未割当であることを確認
   - Production environment variables不足時はbuild段階で停止する
4. Production Vercel Promoteを別承認で実行
5. Production Post-deploy Smokeを実行
6. Production Release Acceptanceを実行
   - runtime logはVercel CLIではなくREST runtime-logs APIから取得
   - exact deploymentの5xxが0件であることをgateにする

Preview artifactは直接Promoteしない。

## Current status

- Production release completed: 2026-10-02
- canonical Production URL: `https://x-clone-olive-chi.vercel.app`
- released application SHA: `e52d5acea5c96623443d0fe65d2db2acc3ff3764`
- released deployment: `dpl_9cChFzxqudMiyMkBKbNPvA9mM4hR`
- Production health: ok
- Production database health: ok
- acceptance 5xx gate: 0
- build-required variable names: audited
- `STAFF_MFA_ENCRYPTION_KEY`: configured in Vercel Production; secret value is not documented
- email/blob operational dependencies: audited
- Production build DB mutation: disabled
