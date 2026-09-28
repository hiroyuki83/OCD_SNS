# CoCo Preview デプロイ・チェックリスト

最終更新: 2026-09-28
対象ブランチ: feature/sanction-appeals-20260928

## デプロイ前

- GitHub Actions が成功している
- Prisma validate / generate が成功
- lint / unit tests / TypeScript / Next.js build が成功
- Playwright E2E が成功
- Preview用DBであることを確認
- DATABASE_URL と PREVIEW_DATABASE_URL が完全一致
- PREVIEW_DATABASE_URL が Production DB ではない
- VERCEL_ENV=preview
- VERCEL_GIT_COMMIT_REF=feature/sanction-appeals-20260928
- seedする場合だけ PREVIEW_SEED_USERS=1
- PREVIEW_TEST_PASSWORD は10〜128文字
- `_prisma_migrations` に41 migration（Sanction + Appealまで）が記録済みであることを確認する

## schema変更

Preview環境では vercel-build が自動で `prisma migrate deploy` を実行しない。
schema変更を含むcommitをPreviewへ出す前に、Preview DBへmigrationを明示的に適用する。

今回の受入済みbaseline migration:

- `20260928071000_add_sanction_records`

今回の適用済みmigration:

- `20260928110500_add_sanction_appeals`

今回のPreview DBは既に41 migrationの履歴を持つため、historical baselineは行わない。
`_prisma_migrations` が欠落していた場合は自動修復せず停止し、原因を確認する。

Production DBへこの手順を流用しない。

## Preview DB migration 実行方法

Preview DB migration は自動実行しない。GitHub Actions の
`.github/workflows/preview-db-release.yml` を `workflow_dispatch` で手動実行する。

安全条件:

- branch が `feature/sanction-appeals-20260928`
- `VERCEL_ENV=preview`
- `DATABASE_URL === PREVIEW_DATABASE_URL`
- 接続hostが承認済み `coco-preview` Neon endpoint
- database名が `neondb`
- confirmation が `MIGRATE_COCO_PREVIEW`
- `PREVIEW_ALLOW_BASELINE=0`

実行順:

1. `npm run preview:db:preflight`
2. `npm run preview:db:migrate`
3. `npm run preview:db:verify`
4. `npm run seed:preview`
5. `npx prisma migrate status`

preflightでは前回受入済みschemaを確認し、`Sanction` tableが存在し、`Appeal` tableがまだ存在しないことを確認する。
verifyでは`Sanction`を維持したまま`Appeal` tableと主要column、および新migrationの適用履歴を確認する。

### Prisma接続先の安全策

Preview環境では `prisma.config.ts` も `PREVIEW_DATABASE_URL` を最優先する。
migration runnerは以下を全てPreview URLへ強制する。

- `DATABASE_URL`
- `PREVIEW_DATABASE_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`

## Vercel deploymentEnabled 切替手順

DB migration前はschema不一致のPreviewを公開しない。

通常状態:

- `security-integration-final-20260926: false`
- `feature/sanction-records-20260928: false`
- `feature/sanction-appeals-20260928: false`
- `main: false`

Preview DB migration / seed / schema verifyが成功した後にのみ、
`feature/sanction-appeals-20260928` を一時的に `true` にして最新Preview deploymentを作る。

Preview acceptance完了後:

- feature branchをmainへmergeする
- feature branchの自動deployを再び `false` にする
- `main` の自動deployは `false` のまま維持する
- Production releaseは別工程で明示的に行う

mainへmergeしただけでProduction deployが開始される設定へ戻してはならない。

## デプロイ後

`npm run smoke:preview -- https://<preview-url>` で公開ページのHTTPスモークテストを行う。

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
- 投稿制限 / 停止のSanction履歴
- 投稿制限 / 停止のSanction Appeal送信・独立審査・取消
- self-test privacy
- account export
- notification preferences
- email change（専用の使い捨てテストユーザー）
- account deletion（専用の使い捨てテストユーザーのみ）

## 停止条件

以下のどれかが不明ならDB migration / seedを実行しない。

- 接続先DBがPreviewか不明
- ProductionとPreviewのURL区別ができない
- migration対象schemaが不明
- migration historyが41件のAppeal受入済み状態と一致しない
- backup / restore経路が確認できない

## Preview受入完了後のmain統合ゲート

mainへmergeする前に以下を確認する。

- 最新commitのVercel Preview deploymentがREADY
- Preview DB migration / seedが成功
- HTTP smoke testが成功
- Preview test usersによる主要機能確認が成功
- runtime logに重大な未解決エラーがない
- GitHub CI / Playwright E2Eが成功
- main mergeによるProduction自動deployが無効である

上記をすべて満たしたらPRをmainへmergeする。

main merge後:

1. main上でCI / E2Eを再確認
2. merge commitとPR番号を `PREVIEW_ROADMAP.md` に記録
3. feature branchの役目終了を確認
4. 不要な一時Neon branchを削除
5. Production releaseは別タスクとしてHOLDのまま維持

## Production release

Production releaseはmain mergeとは別工程。
明示的なrelease判断後にのみ、Production DB backup / migration / deploy / smoke / runtime error scan / rollback確認を行う。


## 今回のSanction Preview受入結果

- rollback branch: `backup-before-sanction-migration-2026-09-28`
- Prisma migration history: 40 applied
- Sanction schema / indexes / foreign keys: verified
- Vercel deployment: `dpl_7ksKuNtxd9oaJzj3vmgJKeePpMNZ` READY
- validated commit: `12ec8cda236efc7d76c593060a036161ee68da65`
- public HTTP smoke: 5 / 5 PASS
- runtime error/fatal: 0
- feature branch auto-deploy: disabled again after acceptance
- main auto-deploy: disabled
- Production: untouched


## 今回のAppeal Previewリリース予定

- baseline: Sanction受入済み **40 migrations**
- pending: `20260928110500_add_sanction_appeals`
- preflight: Sanction present / Appeal absent
- post-migration: Appeal present / migration history **41**
- release branch: `feature/sanction-appeals-20260928`
- Vercel auto-deploy: migration受入前は disabled
- Production: untouched / HOLD


## 今回のAppeal Preview受入結果

- rollback branch: `backup-before-appeal-migration-2026-09-28`
- Prisma migration history: **41 applied**
- Appeal schema / indexes / foreign keys / sanction unique: verified
- Vercel deployment: `dpl_HYXTdW7t9cCrjBzFnsGxBWT1rH3Z` READY
- validated commit: `a8ae408eb312bdf212333c0d641e6fc6b084b0a2`
- public HTTP smoke: **6 / 6 PASS**
- `/appeal`: 200 / UI present
- runtime error/fatal: **0**
- feature branch auto-deploy: disabled again after acceptance
- main auto-deploy: disabled
- Production: untouched / HOLD

認証付きAppealフローはisolated E2E **16 / 16 PASS** で検証済み。
shared Previewの追加seedは認証hashの直接操作が安全チェックで停止したため未実行。
既存5 seed usersは変更していない。
