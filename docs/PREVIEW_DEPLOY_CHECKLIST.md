# CoCo Preview デプロイ・チェックリスト

最終更新: 2026-10-03
対象基準ブランチ: `preview`（Production前の固定受入branch）

## 2026-10-03 固定Preview運用チェック

正式な受入URL:

`https://coco-git-preview-hiroyuki-desperado-yahoocojps-projects.vercel.app`

標準フロー:

1. feature / fix branchで実装
2. `preview` へ統合
3. 固定Preview URLが最新 `preview` commitへ更新されたことを確認
4. CI / E2E / Preview DB / runtime errorを確認
5. USER / ADMIN / MODERATORとして実操作
6. 問題があればpreview側で修正
7. 受入完了後に `preview -> main` をmerge
8. Production releaseは別工程で明示判断

固定Preview環境の前提:

- `vercel.json`: `main=false`, `preview=true`
- Vercel Previewに `PREVIEW_DATABASE_URL` が存在する
- `preview` branch-scoped `STAFF_MFA_ENCRYPTION_KEY` が存在する
- MFAキーはデプロイごとに再生成しない
- Preview DB migration / seed safety guardはGit ref `preview` だけを許可する
- main mergeだけではProductionへdeployしない

Preview DB release:

- `.github/workflows/preview-db-release.yml` を手動実行する
- confirmationは `MIGRATE_COCO_PREVIEW`
- DB Secretは `vercel env run -e preview --git-branch preview` でVercelから直接注入する
- 通常migrationでは `seed_users=false`
- test usersを再初期化する場合だけ `seed_users=true`
- seedを使う場合はGitHub `preview` environmentの `PREVIEW_TEST_PASSWORD` が必要
- seed prerequisiteが不足している場合はDB write前に停止する

受入時に見るもの:

- 一般USERのログイン・投稿・フォロー・通知・設定
- private account
- block / mute
- self-test
- ADMIN / MODERATORのMFA登録・再ログイン
- admin / moderation
- モバイル表示
- UIの文字・ボタンの可読性
- runtime error / 5xx

---


## デプロイ前

- GitHub Actions が成功している
- Prisma validate / generate が成功
- lint / unit tests / TypeScript / Next.js build が成功
- Playwright E2E が成功
- Preview用DBであることを確認
- DATABASE_URL と PREVIEW_DATABASE_URL が完全一致
- PREVIEW_DATABASE_URL が Production DB ではない
- VERCEL_ENV=preview
- VERCEL_GIT_COMMIT_REF=preview
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

- branch が `preview`
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
- Preview test usersによる主要機能確認が成功、または同等のisolated authenticated E2E + shared Preview schema/runtime受入で代替根拠が記録済み
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


### 認証付きshared Preview受入の代替根拠

今回のSanction Appealでは以下を組み合わせて受入とする。

- isolated authenticated Playwright: **16 / 16 PASS**
- SUSPENSION Appeal: PASS
- POST_RESTRICTION Appeal: PASS
- shared Preview DB: **41 migrations / Appeal schema verified**
- Vercel Preview public smoke: **6 / 6 PASS**
- `/appeal`: 200 / UI present
- runtime error/fatal: **0**

GitHub側Preview secretが未設定のため、shared Preview DBへ直接seedする一時workflowは実行前に停止し、削除済み。
既存seed users・認証hash・Sanction/Appealデータは変更していない。


## PR #49 main統合結果

- PR #49: merged
- merge commit: `fc935925c4bb0e11630063eb83839f69ee68bc2b`
- shared Preview migration history: **41**
- final branch Security CI: **173 / 173 PASS**
- final branch Playwright: **16 / 16 PASS**
- main Security CI: **173 / 173 PASS**
- main Playwright: **16 / 16 PASS**
- Production auto-deploy: disabled
- Production DB / deployment: untouched / HOLD


Production releaseの実行手順は `PRODUCTION_RELEASE_RUNBOOK.md` を正本とする。
Preview用のbranch guard / seed / migration手順をProductionへ流用しない。
