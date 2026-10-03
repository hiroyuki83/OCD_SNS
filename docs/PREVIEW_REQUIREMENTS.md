# CoCo Preview 要件定義

最終更新: 2026-10-03
対象基準ブランチ: `preview`
mainへの昇格元: `preview`

この文書を CoCo の固定Preview受入環境に関する要件の正本（source of truth）とする。
仕様変更があった場合は、この文書と `PREVIEW_ROADMAP.md` を更新する。

## 1. サービスの位置づけ

CoCo は、メンタルヘルス領域の当事者コミュニティを想定したSNSである。

中心機能は以下とする。

- テキスト＋画像1枚の投稿
- いいね
- 「わかる」「がんばった」リアクション
- ブックマーク
- フォロー
- 非公開アカウントとフォロー承認
- ブロック / ミュート
- 投稿検索
- 通知
- ソーシャル通知の受信設定（いいね / リアクション / フォロー。運営警告はオフ不可）
- 通報 / モデレーション
- 心理セルフチェック
- 安全支援ページ
- 運営管理

## 2. 明示的に実装しない機能

以下は CoCo の仕様対象外とし、将来機能としても原則実装しない。

- 返信（Reply）
- 引用投稿（Quote post）
- ダイレクトメッセージ（DM）
- 動画投稿
- ライブ配信

### 返信・引用について

過去実装由来の Reply / Quote 関連コードは削除済みであり、現在の正式schemaには含めない。

完了済み:

- `Reply` model 削除
- `Post.quotePostId` / Quote relation 削除
- 関連UI / API / helper参照の削除
- 削除migrationの作成・Preview / Production適用
- 再混入防止テスト

今後も返信・引用投稿を再導入しない限り、Reply / Quote relationをschemaへ追加しない。

## 3. アカウント・認証

- メールアドレス＋パスワード
- メール確認
- ログイン中ユーザーによるメールアドレス変更（新アドレスで再確認後に切替・既存セッション失効）
- パスワード再設定
- ログイン中ユーザーによる通常のパスワード変更（変更後は既存セッションを失効）
- ユーザーデータのJSONエクスポート
- 本人によるアカウント削除（監査整合性を保つ匿名化方式。詳細は `ACCOUNT_LIFECYCLE.md`）
- 公開識別子として email と分離した `@handle` を使用
- ADMIN / MODERATOR / USER の3ロール
- ADMIN / MODERATOR は TOTP 2段階認証を必須とする
- スタッフ用リカバリーコード
- セッション一括失効
- 管理操作の一部で ADMIN パスワード再認証
- 最後の ADMIN は降格不可
- ADMIN 自身による自己降格は禁止

## 4. プロフィール・関係性

- 表示名
- `@handle`
- 自己紹介
- アイコン
- ヘッダー画像
- 自動ハッシュタグ
- 公開 / 非公開アカウント
- フォロー / フォロー解除
- 非公開アカウントへのフォロー申請
- 申請承認 / 拒否
- フォロワー解除
- ブロック
- ミュート

## 5. 投稿

- 最大1000文字
- 画像1枚
- 投稿画像の代替テキスト（任意・最大300文字）
- JPEG / PNG / WebP / GIF
- 画像サイズ・画像構造の検証
- クリップボードからの画像貼り付け
- 本人による投稿削除
- モデレーターによる非表示
- 非表示投稿の復元

投稿操作:

- いいね
- わかる
- がんばった
- ブックマーク
- 通報

返信・引用投稿は行わない。

## 6. フィード・検索

- For You フィード
- Following フィード
- Pagination
- 投稿検索
- ユーザー検索
- `@handle` 検索
- ハッシュタグ検索（投稿内ハッシュタグから検索画面へ遷移可能）
- 非公開アカウント、ブロック、ミュート、停止アカウント等の可視性制御

## 7. 通知

現在対象:

- フォロー
- リアクション
- フォロー承認関連
- 運営警告
- 異議申立て結果（審査後に警告を再度未読化して通知）

ユーザーが変更できる通知設定:
- いいね
- リアクション
- フォロー

今後検討:
- 投稿制限解除通知
- アカウント停止解除通知

返信・メンション由来通知は、返信機能を実装しないため対象外とする。

## 8. 心理セルフチェック

現在:

- Y-BOCS
- IES-R
- ITQ
- LSAS

結果はユーザー自身のアカウントに保存可能。

セルフチェックは診断機能ではなく自己確認用として扱う。

心理検査データについては、一般SNSデータよりセンシティブな情報として扱う。アプリ内では原則として本人だけが履歴を閲覧でき、ADMIN / MODERATOR の通常画面、公開プロフィール、検索、フィードには表示しない。詳細は `SELF_TEST_DATA_PRIVACY.md` を正本とする。

## 9. 安全支援

- 自傷・危険投稿に関する注意表示
- 安全支援ページ
- 緊急窓口 / 相談先の案内
- SELF_HARM 通報カテゴリ

CoCo 自体は医療機関・緊急対応機関として扱わない。

## 10. モデレーション

通報理由:

- HARASSMENT
- SPAM
- IMPERSONATION
- SELF_HARM
- OTHER

通報状態:

- OPEN
- REVIEWING
- RESOLVED
- REJECTED

優先度:

- LOW
- NORMAL
- HIGH
- URGENT

機能:

- 担当者割当
- 対応期限
- 対応メモ
- 投稿非表示 / 復元
- 警告
- 投稿制限
- アカウント停止
- 通報却下
- 解決処理
- Audit Log

## 11. ユーザー制裁

AccountStatus:

- ACTIVE
- POST_RESTRICTED
- SUSPENDED

投稿制限・アカウント停止は `User.status` の実効状態に加えて、独立した `Sanction` レコードとして履歴保存する。

SanctionType:

- WARNING
- POST_RESTRICTION
- SUSPENSION

SanctionStatus:

- ACTIVE
- EXPIRED
- REVOKED

POST_RESTRICTION / SUSPENSION は `Sanction` を正本として保存し、`Appeal` による共通異議申立てを実装済みとする。警告は既存の `ModerationWarning` / `WarningAppeal` を正本として維持する。

投稿制限:

- 1時間
- 24時間
- 72時間

停止:

- 1日
- 7日
- 30日
- ADMIN のみ永久停止可能

停止時には既存セッションを失効させる。

## 12. 警告・異議申立て

- MODERATOR / ADMIN が警告可能
- 警告はユーザー通知に表示
- ユーザーは警告に対して異議申立て可能
- 審査結果は維持 / 取消
- 自分が出した警告の異議申立てを自分で審査しない
- 必要な操作は Audit Log に記録

警告以外の処分への異議申立ては実装済みであり、設計詳細は `APPEAL_MODEL_DESIGN.md` を正本とする。投稿制限・停止は `Sanction` を正本とし、`Appeal.sanctionId` で申立て対象を一意に参照する。

投稿制限・停止Appealの要件:

- 停止中ユーザーも申立てできる
- Appeal専用経路ではメール＋パスワードで本人確認する
- Appeal専用経路では通常のログインセッションを作成しない
- 新規申立て理由は10〜1000文字
- 既に申立て済みの場合は理由欄なしで審査状況を再確認できる
- 1つのSanctionにつきAppealは1件
- 審査結果は維持 / 取消
- 自分自身の申立ては審査しない
- 自分が発行したSanctionのAppealは審査しない
- MODERATORは通常ユーザーのAppealのみ審査可能
- 取消時は別の有効Sanctionが無い場合だけアカウント状態をACTIVEへ戻す
- 審査結果はメール通知し、Appealページからも再認証して確認できる
- Appeal本文はアカウント削除時に匿名化する
- 本人データexportにはSanction / Appeal履歴を含める

Sanction migrationとAppeal migrationは段階的に共有Previewで受入済み。現在の共有Preview migration historyは41件で、両schemaを含む。

## 13. 管理画面

ADMIN:

- ユーザー一覧
- ユーザー詳細
- ロール変更
- アカウント状態変更
- 管理メモ
- ユーザー招待
- パスワード再設定
- Audit Log
- スタッフ MFA 状態
- 運営お知らせ
- モデレーション画面
- モデレーション・制裁履歴をユーザー単位で時系列表示

MODERATOR:

- 通報処理
- 警告
- 許可された範囲の投稿 / ユーザー制裁
- 異議申立て審査

メールアドレス等の個人情報は ADMIN と MODERATOR でアクセス範囲を分離する。

## 14. セキュリティ

- Server-side authorization
- Request validation
- Rate limit
- CSRF / mutation request protection
- private account visibility enforcement
- block / mute visibility enforcement
- upload validation
- browser security headers
- public API で email 非公開
- public API で moderation status 非公開
- staff TOTP MFA
- recovery code hash 保存
- sessionVersion による session revoke
- 管理操作の Audit Log
- アプリ障害時は privacy-safe な incident ID / digest を使い、例外本文や機微情報を画面・ログへ露出しない
- Next.js `instrumentation.ts` の `onRequestError` で未処理のサーバーエラーを privacy-safe logger へ集約する

## 15. Preview / Production

Preview と Production は、branch・deployment・DB・Secret・test userを分離する。

### 15.1 固定Preview環境

Production前の正式な受入環境は以下に固定する。

- GitHub branch: `preview`
- Vercel固定Preview URL: `https://coco-git-preview-hiroyuki-desperado-yahoocojps-projects.vercel.app`
- Vercel target: Preview
- 共有Preview DB: Neon project `coco-preview`
- Production deployment / Production DBとは完全に分離する

feature / fix branchから作られる一時的なVercel Preview deploymentは実装途中の確認には使用してよいが、main統合前の正式な受入環境とはみなさない。

固定Preview URLが最新 `preview` HEADを配信していることを `CoCo Preview Acceptance Ready` で確認してから実操作受入を開始する。

### 15.2 Preview DB接続要件

Preview runtimeのDB接続は `PREVIEW_DATABASE_URL` のみを使用する。

`VERCEL_ENV=preview` の場合、以下へのフォールバックを禁止する。

- `DATABASE_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

`PREVIEW_DATABASE_URL` が未設定の場合はfail closedとし、アプリをProduction DBへ接続してはならない。

固定Preview deploymentでは、Vercelの `PREVIEW_DATABASE_URL` が `preview` branchへ適用されていることを `CoCo Preview Environment Bootstrap` で検証する。

Production DBにPreview test user seed、Preview migration、Preview動作確認用writeを実行してはならない。

### 15.3 Preview DB migration

Preview DB migrationは固定 `preview` branchからのみ実行する。

migration実行条件:

- Git refが `preview`
- `VERCEL_ENV=preview`
- `PREVIEW_MIGRATION_CONFIRM=MIGRATE_COCO_PREVIEW`
- `DATABASE_URL === PREVIEW_DATABASE_URL`
- 接続host / database名が承認済みPreview DBと一致
- read-only preflightが成功

Preview DB release workflowでは、GitHub `preview` environmentの `PREVIEW_DATABASE_URL` を使用する。
Vercel Preview runtime側の同名Secretと同じ共有Preview DBを指すよう同期する。

GitHub側Secretが未設定の場合は、DB write前に停止する。

### 15.4 Preview test user

Preview test usersは共有Preview DBへseedして維持する。

標準test user:

- `coco.preview.public1@example.com`
- `coco.preview.public2@example.com`
- `coco.preview.private@example.com`
- `coco.preview.appeal@example.com`
- `coco.preview.moderator@example.com`
- `coco.preview.moderator2@example.com`
- `coco.preview.admin@example.com`
- `coco.preview.admin2@example.com`
- `coco.preview.admin3@example.com`
- `coco.preview.admin4@example.com`
- `coco.preview.admin5@example.com`

test userの共通パスワードは `PREVIEW_TEST_PASSWORD` で管理し、GitHub文書・ソースコードへ平文保存しない。

通常のmigrationではtest usersを再seedしない。
再seedが必要な場合だけ `seed_users=true` を明示する。

再seed時には以下を行う。

- test userのpasswordを `PREVIEW_TEST_PASSWORD` へ揃える
- email verifiedを有効化
- role / privacy状態をseed定義へ戻す
- staff TOTP状態を未設定へ戻す
- test用sanction / appeal / recovery code等を初期化する
- sessionVersionを更新して既存sessionを失効させる

### 15.5 Preview staff MFA

ADMIN / MODERATORはPreviewでもTOTP 2段階認証を使用する。

固定 `preview` branchにはVercel branch-scoped Secret `STAFF_MFA_ENCRYPTION_KEY` を1つ設定し、デプロイ間で同じ値を維持する。

`STAFF_MFA_ENCRYPTION_KEY` をデプロイごとに再生成してはならない。
再生成すると既存の暗号化済みTOTP secretを復号できなくなるためである。

Preview test usersを明示的に再seedした場合は、staff MFA状態が未設定へ戻ることを前提とする。

### 15.6 PreviewとProductionの昇格経路

標準の昇格順は以下とする。

1. feature / fix branchで実装
2. `preview` へ統合
3. 固定Preview URLが最新 `preview` HEADを配信していることを確認
4. CI / E2E / smoke / runtime error確認
5. USER / ADMIN / MODERATORとして実操作受入
6. 問題があればmainへ入れずPreview側で修正
7. 受入完了後に `preview -> main` をmerge
8. Production releaseは別工程で明示実行

main mergeだけではProduction releaseとみなさない。

### 15.7 Preview branch保持

`preview` は長期運用のacceptance branchとして保持する。

repository branch cleanupでは削除禁止とし、inventoryでは `retained-preview` と分類する。

短時間に `preview` へ複数の直接pushを重ねるとVercel deploymentの完了順によって固定aliasが一時的に古いcommitへ向く可能性があるため、通常の変更はfeature / fix branchでまとめてから `preview` へ統合する。

## 16. バックアップ・復旧

- DB / Blob の復旧方針は `BACKUP_RECOVERY.md` を正本とする。
- Production と Preview のDBを混同しない。
- 破壊的DB操作前に復旧経路を確認する。
- Previewデプロイ前の確認事項は `PREVIEW_DEPLOY_CHECKLIST.md` を使用する。

## 17. 開発検証

Release 前に以下を通す。

- `prisma validate`
- `prisma generate`
- lint
- unit test
- TypeScript typecheck
- Next.js build
- Playwright E2E

主要な認証・ソーシャル・モデレーション・アカウントライフサイクルはE2Eで検証する。


## 18. ブランチ統合・リリース運用

### main の位置づけ

`main` は「コードとして承認済み」の基準ブランチとする。

feature / integration branch上で実装・CI・E2E・Preview検証を完了した後にmainへmergeする。

### main merge条件

以下をすべて満たした場合のみmainへmergeする。

1. GitHub CI / E2Eが成功
2. 最新commitが固定 `preview` branchへ統合済み
3. 固定Preview aliasがその `preview` HEAD SHAを配信していることを確認済み
4. schema変更がある場合のみPreview DB migrationが成功
5. test-user再seedが必要な場合のみseedが成功
6. Preview smoke testと主要機能の実操作受入確認が成功
7. Preview runtime errorに重大な未解決エラーがない
8. main mergeによるProduction自動deployの有無を確認済み
9. 自動Production deployが有効な場合、意図しない本番反映を防止する措置を完了済み

### main mergeとProduction releaseの分離

mainへのmergeをProduction releaseとはみなさない。

`vercel.json` の `main` 自動deploymentは通常無効とし、main pushだけでProductionへ反映されない構成を維持する。

Production releaseは別工程とし、以下を明示的に実施する。

1. Production DB backup / restore経路確認
2. Production migration plan確認
3. Production DB migration
4. Production deploy
5. post-deploy smoke test
6. runtime error scan
7. 問題があればrollback

Production releaseは自動ではなく、明示的なrelease判断の後に実施する。

### 2026-10-02 初回Production release完了

CoCo v1の初回Production releaseは2026-10-02に完了した。

実績:

- released application SHA: `e52d5acea5c96623443d0fe65d2db2acc3ff3764`
- Vercel Production deployment: `dpl_9cChFzxqudMiyMkBKbNPvA9mM4hR`
- Production Stage C Apply: SUCCESS
- Production Vercel Promote: SUCCESS
- Production Post-deploy Smoke: SUCCESS
- Production Release Acceptance: SUCCESS

Production migrationとapplication releaseは同じ操作にまとめず、段階的な明示承認を維持する。

今後の標準的なapplication release経路:

1. Preview artifactでvalidationを行う
2. Production Deploy Readinessを完了する
3. exact current mainからProduction-target artifactをstagingする
4. staging時点ではcanonical Production aliasを移動しない
5. READYとなったexact staged artifactを別承認でPromoteする
6. Production Post-deploy Smokeを実行する
7. Production Release Acceptanceを実行する
8. acceptance完了までrollback pointを保持する

Preview artifactを直接ProductionへPromoteしない。
Vercel Production build内ではDB migrationを実行しない。
main mergeだけではProductionへ自動deployしない。

PR #121で上記release pathを恒久化した。PR #121のmain統合はworkflow / test / documentationの更新であり、accepted済みProduction applicationを自動再deployするものではない。

### integration branchの終了

main merge後に以下を行う。

- main上のCI / E2E再確認
- integration branchの役目終了を確認
- 不要なintegration branchを削除
- 不要な一時Neon branchを削除
- Roadmapへmerge commit / PR番号 /検証結果を記録

## 19. 仕様変更の管理

仕様変更時は以下の順に更新する。

1. この要件定義
2. `PREVIEW_ROADMAP.md`
3. 実装
4. test
5. Preview 確認

チャットで仕様が確定した場合も、GitHub 上の文書を更新して記録する。


## 20. 2026-10-03 固定Preview環境への移行記録

2026-10-03にProduction前の受入環境を長期 `preview` branchへ固定した。

実施内容:

- 固定Vercel Preview aliasを作成
- `preview` pushによるPreview deployを有効化
- `main` pushによるProduction自動deployは無効のまま維持
- 固定Preview aliasと `preview` HEAD SHAの一致を自動検証
- `/login` smokeを自動確認
- `preview` branchをrepository cleanupの削除対象外へ変更
- branch-scoped `STAFF_MFA_ENCRYPTION_KEY` を固定
- Preview DB migrationとtest-user seedを分離
- Preview DB preflight / verifyを現在の受入済みmigration baselineへ更新

### Preview DB誤接続インシデントと再発防止

固定 `preview` branch導入直後、Vercel上の `PREVIEW_DATABASE_URL` が旧 `security-integration-final-20260926` branchにのみ紐付いていた。

そのため固定Preview runtimeでは `PREVIEW_DATABASE_URL` が見えず、従来のDB selectorがProduction用 `DATABASE_URL` へフォールバックした。
結果としてPreview test usersが見えず、ログインは `CredentialsSignin` となった。

確認された事項:

- Preview test usersは消失していなかった
- Preview専用DB自体は正常だった
- Production DBへの意図的なwriteは実施していない
- 原因はVercel environment variableのbranch bindingだった

対応:

- 既存 `PREVIEW_DATABASE_URL` の値は変更せず、branch bindingを `preview` へ移行
- runtime / migration DB selectorをfail-closedへ変更
- Previewで `PREVIEW_DATABASE_URL` が無ければProduction系DB URLへフォールバックしない
- Environment Bootstrapで `PREVIEW_DATABASE_URL` のbranch適用を検証
- 固定Previewから共有Preview DBのtest dataが取得できることを確認
- 一時診断endpointは確認後に削除

このインシデントを受け、Section 15のDB分離・fail-closed要件を恒久要件とする。

