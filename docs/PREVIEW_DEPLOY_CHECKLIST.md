# CoCo Preview デプロイ・チェックリスト

最終更新: 2026-09-28
対象ブランチ: security-integration-final-20260926

## デプロイ前

- GitHub Actions が成功している
- Prisma validate / generate が成功
- lint / unit tests / TypeScript / Next.js build が成功
- Preview用DBであることを確認
- DATABASE_URL と PREVIEW_DATABASE_URL が完全一致
- PREVIEW_DATABASE_URL が Production DB ではない
- VERCEL_ENV=preview
- VERCEL_GIT_COMMIT_REF=security-integration-final-20260926
- seedする場合だけ PREVIEW_SEED_USERS=1
- PREVIEW_TEST_PASSWORD は10〜128文字

## schema変更がある場合

Preview環境では vercel-build が自動で prisma migrate deploy を実行しない。
そのため、schema変更を含むcommitをPreviewへ出す前に、Preview DBへmigrationを明示的に適用する。

今回必要な migration:
- 20260928013000_remove_reply_and_quote_post
- 20260928014500_add_post_image_alt
- 20260928023000_add_notification_preferences
- 20260928031500_add_email_change_pending

Production DBへこの手順を流用しない。

## デプロイ後

npm run smoke:preview -- https://<preview-url> で公開ページのHTTPスモークテストを行う。

その後、Preview test usersで以下を確認する。
- login
- public/private profile
- follow request / approval
- block / mute
- create post
- image alt text
- reactions / bookmark
- report
- moderator warning
- warning appeal
- admin user management
- self-test privacy
- account export
- notification preferences
- email change (専用の使い捨てテストユーザー)
- account deletion (専用の使い捨てテストユーザーのみ)

## 停止条件

以下のどれかが不明ならDB migration / seedを実行しない。
- 接続先DBがPreviewか不明
- ProductionとPreviewのURL区別ができない
- migration対象schemaが不明
- backup / restore経路が確認できない


## Preview受入完了後のmain統合ゲート

Preview確認が終わっても、すぐProductionへは出さない。

mainへmergeする前に以下を確認する。

- 最新commitのVercel Preview deploymentがREADY
- Preview DB migration / seedが成功
- HTTP smoke testが成功
- Preview test usersによる主要機能確認が成功
- runtime logに重大な未解決エラーがない
- GitHub CI / Playwright E2Eが成功
- main mergeがProductionへ自動deployする設定か確認済み
- 自動deployする場合は、意図しないProduction反映を防ぐ措置を先に完了

上記をすべて満たしたら、PRをmainへmergeする。

main merge後:

1. main上でCI / E2Eを再確認
2. merge commitとPR番号を `PREVIEW_ROADMAP.md` に記録
3. integration branchの役目終了を確認
4. 不要な一時Neon branchを削除
5. Production releaseは別タスクとしてHOLDのまま維持

## Production release

Production releaseはmain mergeとは別工程。

明示的なrelease判断後にのみ以下を実行する。

- Production DB backup / restore経路確認
- Production migration plan確認
- Production DB migration
- Production deploy
- post-deploy smoke
- runtime error scan
- 必要時rollback


## Preview DB migration 実行方法

Preview DB migration は自動実行しない。GitHub Actions の
`.github/workflows/preview-db-release.yml` を `workflow_dispatch` で手動実行する。

安全条件:

- branch が `security-integration-final-20260926`
- `VERCEL_ENV=preview`
- `DATABASE_URL === PREVIEW_DATABASE_URL`
- 接続hostが承認済み `coco-preview` Neon endpoint
- database名が `neondb`
- confirmation が `MIGRATE_COCO_PREVIEW`
- baselineを行う場合だけ `allow_baseline=true`

Preview DBは既存schemaを持つ一方、現時点では `_prisma_migrations` が存在しない。
そのため初回のみ、既存historical migrationをSQL再実行せず `prisma migrate resolve --applied`
でbaseline登録してから、今回の未適用migrationを `prisma migrate deploy` する。

対象historical baselineは `20260927002000_add_follow_approval` まで。
その後に実適用するmigration:

- `20260928013000_remove_reply_and_quote_post`
- `20260928014500_add_post_image_alt`
- `20260928023000_add_notification_preferences`
- `20260928031500_add_email_change_pending`

実行順:

1. `npm run preview:db:preflight`
2. historical migration baseline（初回のみ）
3. `npm run preview:db:migrate`
4. `npm run preview:db:verify`
5. `npm run seed:preview`
6. `npx prisma migrate status`

### Prisma接続先の安全策

Preview環境では `prisma.config.ts` も `PREVIEW_DATABASE_URL` を最優先する。
`POSTGRES_URL_NON_POOLING` や `DATABASE_URL` に別環境の値が残っていても、
Preview migrationがそれらを先に選ばないようにする。

さらにmigration runnerは以下を全てPreview URLへ強制する。

- `DATABASE_URL`
- `PREVIEW_DATABASE_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`


## Vercel deploymentEnabled 切替手順

`vercel.json` では、release gate完了前の誤deployを防ぐ。

通常状態:

- `security-integration-final-20260926: false`
- `main: false`

Preview DB migration / seed / schema verifyが完了した後にのみ、
`security-integration-final-20260926` を一時的に `true` にして最新Preview deploymentを作る。

Preview acceptance完了後:

- integration branchをmainへmergeする
- `main` の自動deployは `false` のまま維持する
- Production releaseは別工程で明示的に行う

mainへmergeしただけでProduction deployが開始される設定へ戻してはならない。
