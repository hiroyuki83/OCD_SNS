# CoCo Production Environment Audit

最終更新: 2026-09-28

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
4. **`prisma migrate deploy` を実行**
5. Prisma generate
6. Next.js build

したがって、現在の構成ではProduction deploymentを開始すると、未適用migrationがbuild工程で自動適用され得る。

これはrunbook上の「DB migration」と「app deployment」を運用上分離する方針と注意深く整合させる必要がある。

安全運用:

- Production deploy前にread-only preflightを必ず完了
- rollback pointを先に作る
- destructive migration gateを解消
- migration dry runを先に通す
- Production DB migrationを明示工程で先に適用する場合、後続Vercel buildの `prisma migrate deploy` はno-opになることを確認
- preflight未完了の状態でProduction deployを開始しない

## SSL mode

Current Production runtimeではPostgreSQL clientから以下のcompatibility warningを確認済み。

- `sslmode=require/prefer/verify-ca` の将来の意味変更warning

Mainの `normalizePostgresSslMode` は:

- require
- prefer
- verify-ca

を `verify-full` へ正規化する。

したがってmain release後は現在のSSL warningが解消することをpost-deploy runtime scanで確認する。

## Current status

- Production env values: not exposed by connected tooling
- exact Production DB URL: unresolved
- build-required variable names: audited
- newly required Production env: `STAFF_MFA_ENCRYPTION_KEY`
- email/blob operational dependencies: audited
- Production deployment: NOT STARTED
