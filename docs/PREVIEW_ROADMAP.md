# CoCo Preview Roadmap / Progress Tracker

最終更新: 2026-09-28
対象基準ブランチ: `main`
現在の実装ブランチ: `feature/sanction-appeals-20260928`

この文書を Preview 版の進捗管理表として使用する。

## ステータス

- DONE: 実装済み
- IN PROGRESS: 作業中
- TODO: 未着手
- HOLD: 保留
- OUT OF SCOPE: 実装しない

## 仕様上の確定事項

| ID | 内容 | Status |
|---|---|---|
| DEC-001 | 返信機能は実装しない | OUT OF SCOPE |
| DEC-002 | 引用投稿は実装しない | OUT OF SCOPE |
| DEC-003 | DMは実装しない | OUT OF SCOPE |
| DEC-004 | 動画投稿は実装しない | OUT OF SCOPE |
| DEC-005 | ライブ配信は実装しない | OUT OF SCOPE |
| DEC-006 | 残存している Reply / Quote 関連 schema・古いコードは削除する | DONE |
| DEC-007 | 通常のPreview検証は共有Preview DB 1個を常設して使う | DONE |
| DEC-008 | PR専用Neon branchはschema変更・破壊的migration検証時だけ一時作成し、検証後に削除する | DONE |
| DEC-009 | mainは「コードとして承認済み」の基準ブランチとする | DONE |
| DEC-010 | mainへのmergeとProduction deployは別工程とし、Production releaseは明示操作でのみ行う | DONE |

## 現在実装済みの主要機能

| ID | 内容 | Status |
|---|---|---|
| CORE-001 | メール＋パスワード認証 | DONE |
| CORE-002 | メール確認 | DONE |
| CORE-003 | パスワード再設定 | DONE |
| CORE-004 | 公開 @handle | DONE |
| CORE-005 | プロフィール編集 | DONE |
| CORE-006 | 公開 / 非公開アカウント | DONE |
| CORE-007 | フォロー / フォロー承認 | DONE |
| CORE-008 | ブロック / ミュート | DONE |
| CORE-009 | テキスト投稿 | DONE |
| CORE-010 | 画像投稿 | DONE |
| CORE-011 | いいね | DONE |
| CORE-012 | わかる / がんばった | DONE |
| CORE-013 | ブックマーク | DONE |
| CORE-014 | 投稿検索 | DONE |
| CORE-015 | For You / Following feed | DONE |
| CORE-016 | Pagination | DONE |
| CORE-017 | 通知 | DONE |
| CORE-018 | 投稿通報 | DONE |
| CORE-019 | Y-BOCS | DONE |
| CORE-020 | IES-R | DONE |
| CORE-021 | ITQ | DONE |
| CORE-022 | LSAS | DONE |
| CORE-023 | Safety resources | DONE |

## モデレーション / 管理

| ID | 内容 | Status |
|---|---|---|
| MOD-001 | 通報キュー | DONE |
| MOD-002 | 状態 / 理由 / 優先度 / 担当者フィルタ | DONE |
| MOD-003 | 投稿非表示 / 復元 | DONE |
| MOD-004 | 警告 | DONE |
| MOD-005 | 投稿制限 | DONE |
| MOD-006 | 期限付き停止 | DONE |
| MOD-007 | ADMIN永久停止 | DONE |
| MOD-008 | 警告のユーザー通知 | DONE |
| MOD-009 | 警告への異議申立て | DONE |
| MOD-010 | 異議申立て審査 | DONE |
| MOD-011 | Audit Log | DONE |
| MOD-012 | 管理メモ | DONE |
| MOD-013 | ADMINユーザー招待 | DONE |
| MOD-014 | スタッフ権限管理 | DONE |
| MOD-015 | スタッフセキュリティ一覧 | DONE |
| MOD-016 | 運営お知らせ | DONE |

## セキュリティ

| ID | 内容 | Status |
|---|---|---|
| SEC-001 | Public handle と email の分離 | DONE |
| SEC-002 | Private account visibility enforcement | DONE |
| SEC-003 | Block / mute authorization boundaries | DONE |
| SEC-004 | Request validation / mutation security | DONE |
| SEC-005 | Rate limit | DONE |
| SEC-006 | Upload validation | DONE |
| SEC-007 | Security headers | DONE |
| SEC-008 | ADMIN / MODERATOR TOTP MFA | DONE |
| SEC-009 | Recovery codes | DONE |
| SEC-010 | sessionVersion による session revoke | DONE |
| SEC-011 | ADMIN重要操作の再認証 | DONE |
| SEC-012 | 最後のADMIN降格防止 | DONE |

## 次の優先タスク

| ID | 内容 | Priority | Status |
|---|---|---:|---|
| NEXT-001 | Reply model と関連 relation を Prisma schema から削除 | P0 | DONE |
| NEXT-002 | Quote post fields / relation を Prisma schema から削除 | P0 | DONE |
| NEXT-003 | Reply / Quote の残存コードを全検索して削除 | P0 | DONE |
| NEXT-004 | Reply / Quote 削除 migration を作成 | P0 | DONE |
| NEXT-005 | Reply / Quote 削除後に validate / lint / test / typecheck / build | P0 | DONE |
| NEXT-006 | 最新 Preview branch を Vercel Preview に同期 | P0 | DONE |
| NEXT-007 | Preview DB migration / seed / smoke test | P0 | DONE |
| NEXT-008 | Playwright E2E 基盤導入 | P0 | DONE |
| NEXT-009 | 登録→確認→ログイン E2E | P0 | DONE |
| NEXT-010 | private follow approval E2E | P0 | DONE |
| NEXT-011 | block / mute E2E | P0 | DONE |
| NEXT-012 | 投稿 / リアクション / bookmark / 削除 E2E | P0 | DONE |
| NEXT-013 | 通報→moderation→警告 E2E | P0 | DONE |
| NEXT-014 | 警告→異議申立て→審査 E2E | P0 | DONE |
| NEXT-015 | ADMIN role / status change E2E | P0 | DONE |
| NEXT-016 | staff TOTP / recovery code E2E | P0 | DONE |
| NEXT-017 | session revoke E2E | P0 | DONE |
| NEXT-018 | 心理検査データのアクセス権仕様を明文化 | P0 | DONE |
| NEXT-019 | 心理検査データを管理画面から原則参照不可にする確認 / 修正 | P0 | DONE |
| NEXT-020 | アカウント削除 | P1 | DONE |
| NEXT-021 | ユーザーデータエクスポート | P1 | DONE |
| NEXT-022 | メールアドレス変更 | P1 | DONE |
| NEXT-023 | 通常のパスワード変更 | P1 | DONE |
| NEXT-024 | 制裁履歴をユーザー単位で統合表示 | P1 | DONE |
| NEXT-025 | 警告以外の処分への Appeal model を検討 | P1 | DONE |
| NEXT-026 | 異議申立て結果通知 | P1 | DONE |
| NEXT-027 | 通知設定 | P2 | DONE |
| NEXT-028 | ユーザー / @handle 検索 | P2 | DONE |
| NEXT-029 | ハッシュタグ検索 | P2 | DONE |
| NEXT-030 | 画像 alt text | P2 | DONE |
| NEXT-031 | キーボード / focus / screen reader 監査 | P2 | DONE |
| NEXT-032 | アプリレベルのエラー監視 | P2 | DONE |
| NEXT-033 | DB / Blob バックアップ・復旧手順の文書化 | P2 | DONE |
| NEXT-034 | Preview最終受入確認（主要機能・migration・smoke・runtime error確認） | P0 | DONE |
| NEXT-035 | main統合前ゲート確認（NEXT-006/007/034完了、Production自動deployの有無確認） | P0 | DONE |
| NEXT-036 | PR #47 を main へmerge | P0 | DONE |
| NEXT-037 | main merge後のCI / E2E再確認 | P0 | DONE |
| NEXT-038 | integration branch終了・不要な一時Neon branch整理 | P1 | IN PROGRESS（Neon完了 / GitHub branch手動削除待ち） |
| NEXT-039 | Production release準備（Production DB backup / migration plan / deploy plan） | P0 | IN PROGRESS（read-only identity gate） |
| NEXT-040 | Productionへ明示release・post-deploy smoke / error scan | P0 | HOLD |
| NEXT-041 | 投稿制限・停止を第一級 Sanction レコードとして永続化 | P1 | DONE |
| NEXT-042 | Sanction を対象にした共通 Appeal を実装 | P1 | DONE |

## リリース進行フェーズ

mainへ統合する位置を、以下のゲートで固定する。

| Phase | 内容 | 完了条件 | Status |
|---|---|---|---|
| PHASE-A | 機能実装 | 要件上の主要機能・セキュリティ・管理機能が実装済み | DONE |
| PHASE-B | ローカル/CI検証 | Prisma / lint / unit / TypeScript / build / Playwright E2E が成功 | DONE |
| PHASE-C | Preview DB同期 | Preview専用DBを特定し、backup/snapshot後にmigration・seedを完了 | DONE |
| PHASE-D | Preview最終受入 | 最新commitのVercel Previewでsmoke・主要機能・runtime error確認 | DONE |
| PHASE-E | main統合ゲート | PHASE-C/D完了、Production自動deployの有無と影響を確認 | DONE |
| PHASE-F | mainへ統合 | PR #47をmainへmergeし、main上のCI/E2Eを再確認 | DONE |
| PHASE-G | 統合後整理 | integration branchと不要な一時Neon branchを整理 | IN PROGRESS（Neon完了 / GitHub branch手動削除待ち） |
| PHASE-H | Production release | 別途明示承認のうえProduction DB migration→deploy→smoke | HOLD |

### mainへ統合するタイミング

**PHASE-D「Preview最終受入」が完了し、PHASE-Eのmain統合ゲートを通過した直後にmainへmergeする。**

main mergeの必須条件:

1. `NEXT-006` 最新commitがVercel Previewに同期済み
2. `NEXT-007` Preview DB migration / seed / smokeが成功
3. `NEXT-034` Preview最終受入確認が成功
4. CI / E2Eが成功
5. Preview runtime errorに重大な未解決エラーがない
6. main mergeがProductionへ自動deployする設定かを確認済み
7. 自動Production deployする場合は、merge前に自動deployを止めるか、Production release準備を先に完了する

**mainへのmerge自体をProduction releaseとは扱わない。**
Production releaseは `NEXT-039/040` の別工程とし、明示的に実施する。

### DB運用ルール

- 常設DBは原則2系統:
  - Production DB
  - 共有Preview DB（`coco-preview`）
- PRごとのDBは通常作らない
- schema変更・破壊的migration検証が必要なときだけ一時Neon branchを作る
- 一時branchは検証完了後またはPR終了後に削除する
- 一時branchを恒久的に増やさない
- Preview DBのdefault branch名が `production` でも、Neon project `coco-preview` 内のbranchであり、本番DBとは区別する
- 将来的にはPreview側default branch名を `preview` へ変更し、誤認しにくくする

### Vercel deploy制御

調査の結果、Vercel Previewが古いcommitで止まっていた原因は `vercel.json` の設定だった。

- `security-integration-final-20260926` はPreview DB migration後に一時的に有効化し、最新Preview受入を完了
- `main: false` を維持し、main mergeだけではProductionへdeployしない

今後は:

1. Preview DB migration完了
2. integration branchのVercel deployを有効化
3. 最新Previewを受入確認
4. mainへmerge
5. Production release時のみ明示的にProduction deploy

の順で進める。

### 現在位置

現在は **PHASE-G / NEXT-038**。

完了済み:
- Preview専用Neon project `coco-preview` / DB `neondb` を特定
- migration前snapshot `before-preview-schema-sync-2026-09-28` を作成
- 既存35 migrationをbaseline登録し、今回4 migrationを実適用
- `_prisma_migrations` 39件を正常登録
- `Reply` / `quotePostId` 削除
- `Post.imageAlt` 追加
- 通知設定3列追加
- `EmailVerificationToken.pendingEmail` 追加
- Preview acceptance用 core seed user 5件を確認
- 最新Vercel Preview deployment `dpl_7DCntJcd975vxrVTFVDWniMxHiSB` READY
- Preview public smoke: `/`, `/login`, `/register`, `/explore`, `/safety` がすべて HTTP 200
- PostgreSQL SSL modeを `verify-full` へ明示し、最新deploymentで旧warningの再発なし
- Preview受入時 CI / E2E: SUCCESS
- PR #47 を mainへmerge
- main merge commit: `09a720a6a71ed195fdc038008fb27c8347e4b294`
- main上 Security integration CI run `36352909511`: SUCCESS / unit **144 / 144 PASS**
- main上 CoCo E2E run `36352909491`: SUCCESS / Playwright **15 / 15 PASS**
- `main` のVercel自動deployは無効のままで、Production deployは発生していない

未完了:
- integration branch `security-integration-final-20260926` の終了・削除
- migration検証用の一時Neon branch整理
- Production release準備（NEXT-039 / HOLD）
- Production release（NEXT-040 / HOLD）


## 実装しない機能

| ID | 内容 | Status |
|---|---|---|
| NOSCOPE-001 | 返信 | OUT OF SCOPE |
| NOSCOPE-002 | 引用投稿 | OUT OF SCOPE |
| NOSCOPE-003 | DM | OUT OF SCOPE |
| NOSCOPE-004 | 動画投稿 | OUT OF SCOPE |
| NOSCOPE-005 | ライブ配信 | OUT OF SCOPE |

## 進捗更新ルール

チャットで作業した際は、完了したタスクの Status を更新する。

例:

- 「NEXT-001 完了」
- 「NEXT-008 IN PROGRESS」
- 「NEXT-025 HOLD」

複数タスクを一度に進めた場合も、このIDを基準に進捗を更新する。

新しい仕様変更があった場合は、DEC-ID または新しい NEXT-ID を追加する。

リリース作業では NEXT-ID だけでなく PHASE-A〜H も更新し、現在どのゲートにいるかを常に明示する。
mainへmergeした場合は、merge commit / PR番号 / main上のCI結果をこの文書へ記録する。
Productionへreleaseした場合も、deploy ID / migration結果 / smoke結果を記録する。


## 2026-09-28 実装バッチ（30タスク）

| # | 内容 | Status |
|---:|---|---|
| 1 | Reply / Quote の全ソース参照監査 | DONE |
| 2 | User から Reply relation を削除 | DONE |
| 3 | Post から Reply relation を削除 | DONE |
| 4 | Reply model を削除 | DONE |
| 5 | Quote post fields / relation を削除 | DONE |
| 6 | Reply / Quote 削除 migration を追加 | DONE |
| 7 | Reply / Quote 再混入防止テストを追加 | DONE |
| 8 | 心理セルフチェックデータのプライバシー要件を文書化 | DONE |
| 9 | ADMIN が心理検査データを直接読まない回帰テスト | DONE |
| 10 | MODERATOR が心理検査データを直接読まない回帰テスト | DONE |
| 11 | 公開プロフィール / user API が心理検査データを読まない回帰テスト | DONE |
| 12 | 心理検査履歴の本人 userId スコープを回帰テスト化 | DONE |
| 13 | 心理検査画面に保存結果の公開範囲を明示 | DONE |
| 14 | パスワード変更入力の共通バリデーションを追加 | DONE |
| 15 | パスワード変更バリデーションのテストを追加 | DONE |
| 16 | 本人による通常パスワード変更 Server Action を追加 | DONE |
| 17 | パスワード変更時の全セッション失効・Audit Log を追加 | DONE |
| 18 | 設定画面にパスワード変更 UI を追加 | DONE |
| 19 | 投稿画像の代替テキスト正規化・上限検証を追加 | DONE |
| 20 | 代替テキストの単体テストを追加 | DONE |
| 21 | Post.imageAlt と DB migration を追加 | DONE |
| 22 | 投稿フォームに画像説明入力欄を追加 | DONE |
| 23 | Feed / 投稿詳細で代替テキストを表示 | DONE |
| 24 | プロフィール / ブックマークで代替テキストを表示 | DONE |
| 25 | 投稿検索 / 公開プロフィール API に代替テキストを反映 | DONE |
| 26 | ユーザー検索のプライバシー境界 helper を追加 | DONE |
| 27 | ユーザー検索の privacy / PII 回帰テストを追加 | DONE |
| 28 | ユーザー・@handle 検索 API を追加 | DONE |
| 29 | 検索画面にユーザー検索・独立 pagination を追加 | DONE |
| 30 | #ハッシュタグ / @handle 検索 prefix の回帰テストと要件同期 | DONE |

### バッチ後の検証

GitHub Actions `Security integration CI` run 36334031017 で最終確認済み。Prisma validate / generate / lint / 78 unit tests / TypeScript / Next.js production build はすべて成功。検証 commit: `b9541cd0bdf4b830f678824db16f8a9050da8c5a`。


## 2026-09-28 実装バッチ2（30タスク）

| # | 内容 | Status |
|---:|---|---|
| 1 | Preview seed安全判定helperを追加 | DONE |
| 2 | Preview seed安全判定の単体テストを追加 | DONE |
| 3 | DATABASE_URLとPREVIEW_DATABASE_URL完全一致をseed条件に追加 | DONE |
| 4 | アカウントexport用filename/header helperを追加 | DONE |
| 5 | export responseのno-store / attachmentテストを追加 | DONE |
| 6 | 本人データJSON export APIを追加 | DONE |
| 7 | 設定画面用データexport UIを追加 | DONE |
| 8 | 設定ページへデータexportを統合 | DONE |
| 9 | デスクトップの動作しないプロフィールbuttonを非interactive化 | DONE |
| 10 | モバイルの動作しないプロフィールbuttonを非interactive化 | DONE |
| 11 | 未読通知件数をscreen readerへ伝えるaria-labelを追加 | DONE |
| 12 | pagination linkのkeyboard focus表示を改善 | DONE |
| 13 | モデレーション統合タイムラインbuilderを追加 | DONE |
| 14 | モデレーションタイムラインの単体テストを追加 | DONE |
| 15 | ADMINユーザー詳細へ制裁・モデレーション時系列表示を追加 | DONE |
| 16 | account exportの秘密情報混入防止テストを追加 | DONE |
| 17 | account export仕様書を追加 | DONE |
| 18 | DB / Blobバックアップ・復旧方針を文書化 | DONE |
| 19 | Previewデプロイ安全チェックリストを追加 | DONE |
| 20 | Preview公開ページHTTP smoke test scriptを追加 | DONE |
| 21 | npm smoke:preview scriptを追加 | DONE |
| 22 | privacy-safe operational error helperを追加 | DONE |
| 23 | operational errorにPIIが入らない単体テストを追加 | DONE |
| 24 | account export失敗時にincident IDを返す処理を追加 | DONE |
| 25 | App Router error boundaryを追加 | DONE |
| 26 | root global error fallbackを追加 | DONE |
| 27 | 通知avatarの冗長なscreen reader読み上げを修正 | DONE |
| 28 | 運用エラーログのプライバシー方針を文書化 | DONE |
| 29 | Preview要件定義を今回の実装へ同期 | DONE |
| 30 | Previewロードマップを今回の実装へ同期 | DONE |

### バッチ2で意図的に未実施

- NEXT-006: Vercel Preview最新同期
- NEXT-007: Preview DB migration / seed / smoke test

今回のschema変更にはReply/Quote削除とPost.imageAlt追加が含まれるため、Preview DBの接続先を安全に特定できるまではmigrationを実行しない。


## 2026-09-28 実装バッチ3（30タスク）

| # | 内容 | Status |
|---:|---|---|
| 1 | 既存Playwright E2E基盤を監査 | DONE |
| 2 | パスワード変更E2Eの再ログイン手順を修正 | DONE |
| 3 | staff MFA E2Eのフォームlocatorを修正 | DONE |
| 4 | staff MFA登録helperを共通化 | DONE |
| 5 | TOTPログインhelperを追加 | DONE |
| 6 | staff MFAテストを共通helperへ移行 | DONE |
| 7 | E2E用Moderator 2をPreview seedへ追加 | DONE |
| 8 | E2E用Admin 2をPreview seedへ追加 | DONE |
| 9 | E2E用Admin 3をPreview seedへ追加 | DONE |
| 10 | moderation report cardへ安定したE2E hookを追加 | DONE |
| 11 | appeal cardへ安定したE2E hookを追加 | DONE |
| 12 | warning notificationへ安定したE2E hookを追加 | DONE |
| 13 | 投稿検索→詳細→通報helperを追加 | DONE |
| 14 | 通報→対応中→警告E2Eを追加 | DONE |
| 15 | 警告→異議申立てE2Eを追加 | DONE |
| 16 | ADMINによる異議申立て取消審査E2Eを追加 | DONE |
| 17 | 異議申立て結果のユーザー表示E2Eを追加 | DONE |
| 18 | ADMIN role変更E2Eを追加 | DONE |
| 19 | ADMIN投稿制限 / 解除E2Eを追加 | DONE |
| 20 | ADMIN停止 / 解除E2Eを追加 | DONE |
| 21 | アカウントデータexport E2Eを追加 | DONE |
| 22 | 投稿画像alt text E2Eを追加 | DONE |
| 23 | rootから実行できる test:e2e scriptを追加 | DONE |
| 24 | CIでPlaywright .only禁止とretryを設定 | DONE |
| 25 | PRでもE2Eを実行するworkflowを追加 | DONE |
| 26 | いいね / リアクション / フォロー通知設定schemaを追加 | DONE |
| 27 | 通知設定migrationを追加 | DONE |
| 28 | 通知設定のServer Action / UI / parser testを追加 | DONE |
| 29 | 通知生成処理へユーザー設定を適用 | DONE |
| 30 | push / PR CI重複実行をhead branch単位で抑制 | DONE |

### バッチ3検証

検証commit: `0bdb167cd1627d0ddee48d8ab398cdc687e97cc7`

- Security integration CI run `36340956117`: SUCCESS
  - Prisma validate / generate: SUCCESS
  - lint: SUCCESS
  - unit tests: 106 / 106 PASS
  - TypeScript: SUCCESS
  - Next.js production build: SUCCESS
- CoCo E2E run `36340956049`: SUCCESS
  - Playwright: 14 / 14 PASS
  - 登録→メール確認→ログイン、パスワード変更、session revoke
  - private follow approval、block / mute
  - 投稿 / reaction / bookmark / delete、画像alt text
  - report→moderation→warning→appeal→review
  - ADMIN role / status change
  - staff TOTP / recovery code
  - account export / accessibility

以上をもって NEXT-008〜017 を DONE とする。


## 2026-09-28 実装バッチ4（30タスク）

| # | 内容 | Status |
|---:|---|---|
| 1 | アカウント削除確認入力parserを追加 | DONE |
| 2 | アカウント削除入力parserの単体テストを追加 | DONE |
| 3 | 本人によるアカウント削除Server Actionを追加 | DONE |
| 4 | ADMIN / MODERATORの自己削除を禁止 | DONE |
| 5 | 削除時に認証情報・プロフィールを匿名化しsessionを失効 | DONE |
| 6 | 削除時に投稿本文・画像URL・画像altを消去 | DONE |
| 7 | 削除時にlike / bookmark / reaction / follow / block / mute / notificationを削除 | DONE |
| 8 | 削除時にY-BOCS / IES-R / ITQ / LSASと認証tokenを削除 | DONE |
| 9 | 削除ユーザー自身の通報詳細・異議申立て本文を消去 | DONE |
| 10 | DB確定後に管理対象Blobをbest-effort削除 | DONE |
| 11 | 設定画面にアカウント削除UIを追加 | DONE |
| 12 | 削除完了メッセージとログイン不能化を追加 | DONE |
| 13 | アカウント削除のprivacy回帰テストを追加 | DONE |
| 14 | EmailVerificationTokenへpendingEmail schemaを追加 | DONE |
| 15 | pendingEmail migrationを追加 | DONE |
| 16 | メール変更入力validationを追加 | DONE |
| 17 | メール変更validationの単体テストを追加 | DONE |
| 18 | 新メール宛て変更確認メール送信を追加 | DONE |
| 19 | 現在パスワード確認付きメール変更申請Actionを追加 | DONE |
| 20 | 確認リンクでメール変更確定＋全session失効を実装 | DONE |
| 21 | 設定画面へメール変更UIを追加 | DONE |
| 22 | メール変更schema / session revoke回帰テストを追加 | DONE |
| 23 | メール変更→旧メール無効→新メールログイン→削除のE2Eを追加 | DONE |
| 24 | 警告以外のAppeal拡張をSanction + Appeal方針として設計 | DONE |
| 25 | 異議申立て審査結果を警告再未読化で通知する回帰テストを追加 | DONE |
| 26 | 異議申立て結果が通知バッジへ戻るE2Eを追加 | DONE |
| 27 | operational error loggerをruntime-neutral化 | DONE |
| 28 | Next.js onRequestError instrumentationを追加 | DONE |
| 29 | auth / Blob / email / RateLimitの生エラーログをprivacy-safe化 | DONE |
| 30 | アカウント・Appeal・監視・Preview migration要件を文書同期 | DONE |

### バッチ4検証

コード検証commit: `85a840478f491a48a74df2d5c279d82e111cd72b`

- Security integration CI run `36342472584`: SUCCESS
  - Prisma validate / generate: SUCCESS
  - lint: SUCCESS
  - unit tests: 123 / 123 PASS
  - TypeScript: SUCCESS
  - Next.js production build: SUCCESS
- CoCo E2E run `36342472742`: SUCCESS
  - isolated PostgreSQLへの全migration適用: SUCCESS
  - Preview seed: SUCCESS
  - Playwright: 15 / 15 PASS
  - 新規追加のメール変更 / アカウント削除ライフサイクルを含む

追加の安全修正:
- `pendingEmail` のPrisma fieldを誤って PasswordResetToken に置かない回帰テストを追加
- メール確認・メール変更の競合時はtoken消費だけをcommitせずtransaction全体をrollback
- アカウント削除の競合時は部分削除をcommitせずtransaction全体をrollback
- RateLimit keyはSHA-256化済みであることを再確認し、DBエラーの生ログもprivacy-safe loggerへ統一

以上をもって NEXT-020 / NEXT-022 / NEXT-025 / NEXT-026 / NEXT-032 を DONE とする。
NEXT-006 は Vercel Preview最新同期待ち。NEXT-007 は Preview DB特定・schema差分確認・snapshot作成まで完了し、migration / seed / smoke待ちのため IN PROGRESS。


## 2026-09-28 リリース安全化バッチ5

| # | 内容 | Status |
|---:|---|---|
| 1 | Preview環境のPrisma migration接続先をPREVIEW_DATABASE_URL最優先へ変更 | DONE |
| 2 | coco-preview承認済みNeon host / DB名をmigration guardへ固定 | DONE |
| 3 | VERCEL_ENV / branch / confirmation / DB URL一致条件をmigration guardへ追加 | DONE |
| 4 | Preview migration guard単体テストを追加 | DONE |
| 5 | Preview DB preflight scriptを追加 | DONE |
| 6 | Preview schema post-migration verify scriptを追加 | DONE |
| 7 | guarded Preview migration runnerを追加 | DONE |
| 8 | migration runner単独実行でもpreflight→migration→verifyを必須化 | DONE |
| 9 | Prisma migration履歴不在時のhistorical baseline手順を実装 | DONE |
| 10 | historical / pending migration計画を共通moduleへ集約 | DONE |
| 11 | migration計画とrepository migrationディレクトリの完全一致テストを追加 | DONE |
| 12 | 手動専用 Preview DB release GitHub Actions workflowを追加 | DONE |
| 13 | Preview DB workflowのbranch / confirmation / secret安全条件を回帰テスト化 | DONE |
| 14 | Vercel Previewが更新されなかった原因をvercel.json deploymentEnabledと特定 | DONE |
| 15 | mainのVercel自動deployを無効化し、main mergeとProduction releaseを分離 | DONE |
| 16 | integration branchもDB migration完了まではPreview自動deploy無効を維持 | DONE |
| 17 | Vercel release policyを回帰テスト化 | DONE |
| 18 | CI / E2Eをintegration push重複実行からPR検証 + main push検証へ整理 | DONE |
| 19 | report E2EをAPI完了alertまで待つよう安定化 | DONE |
| 20 | warning appeal E2Eを一時UIではなく永続化後server-rendered state待ちへ安定化 | DONE |
| 21 | PR #47本文を現在のmain / Production分離方針へ更新 | DONE |
| 22 | Preview DBが想定したpre-migration schemaであることを読み取り再確認 | DONE |

### バッチ5検証

コード検証commit: `c16bf160edde045c21fad44f4080f17f367b8d90`

- Security integration CI run `36349415279`: SUCCESS
  - Prisma validate / generate: SUCCESS
  - lint: SUCCESS
  - unit tests: **139 / 139 PASS**
  - TypeScript: SUCCESS
  - Next.js production build: SUCCESS
- CoCo E2E run `36349415285`: SUCCESS
  - isolated PostgreSQLへの全migration適用: SUCCESS
  - Preview seed: SUCCESS
  - application build: SUCCESS
  - Playwright: **15 / 15 PASS**
  - moderation report → warning → appeal → overturn flowを含む

### 現在のリリース位置

引き続き **PHASE-C / NEXT-007 IN PROGRESS**。

コード側のPreview migration安全化は完了したが、実Preview DBへの破壊的migrationは未実行。

次の順序:

1. Preview DB migrationを明示承認のうえ実行
2. historical Prisma migrationをbaseline登録（初回のみ）
3. pending 4 migrationsを適用
4. Preview seed / schema verify
5. `security-integration-final-20260926` のVercel deploymentを有効化
6. 最新Preview deploymentを作成
7. NEXT-034 Preview最終受入
8. NEXT-035 main統合ゲート
9. NEXT-036 PR #47をmainへmerge



## 2026-09-28 Preview受入・main統合完了

### Preview DB

- Neon project: `coco-preview`
- project ID: `plain-dawn-64792117`
- DB: `neondb`
- snapshot: `before-preview-schema-sync-2026-09-28`
- Prisma migration history: **39 / 39**
- pending release migrations: **4 / 4 applied**
- core Preview seed users: **5 users verified**

### Preview deployment

- validated code commit: `d179443c939a25b2eae96602438ef05ff2676b52`
- deployment: `dpl_7DCntJcd975vxrVTFVDWniMxHiSB`
- state: **READY**
- public smoke:
  - `/`: 200
  - `/login`: 200
  - `/register`: 200
  - `/explore`: 200
  - `/safety`: 200
- latest deployment runtime log: PostgreSQL SSL alias warningの再発なし

### main integration

- PR: **#47**
- merge commit: `09a720a6a71ed195fdc038008fb27c8347e4b294`
- Production auto-deploy: **disabled**

Post-merge validation:

- Security integration CI `36352909511`: **SUCCESS**
  - unit: **144 / 144 PASS**
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E `36352909491`: **SUCCESS**
  - all migrations: PASS
  - E2E seed: PASS
  - Playwright: **15 / 15 PASS**

現在は **PHASE-G / NEXT-038**。
Production releaseは引き続き `NEXT-039 / NEXT-040` としてHOLDする。


## 2026-09-28 実装バッチ6: Sanction永続化（40タスク）

対象branch: `feature/sanction-records-20260928`

| # | 内容 | Status |
|---:|---|---|
| 1 | main統合後の最新状態を再確認 | DONE |
| 2 | 制裁タイムラインの `USER_STATUS_CHANGE` / `USER_STATUS_CHANGED` 不整合を特定 | DONE |
| 3 | `SanctionType` enumを追加 | DONE |
| 4 | `SanctionStatus` enumを追加 | DONE |
| 5 | `Sanction` modelを追加 | DONE |
| 6 | UserへSanction target/actor relationを追加 | DONE |
| 7 | ReportへSanction relationを追加 | DONE |
| 8 | Sanction用DB indexを追加 | DONE |
| 9 | Sanction migrationを追加 | DONE |
| 10 | 通報画面の投稿制限時にSanctionを永続化 | DONE |
| 11 | 通報画面のアカウント停止時にSanctionを永続化 | DONE |
| 12 | 新処分前に期限切れSanctionをEXPIREDへ整理 | DONE |
| 13 | 新処分で置換される有効SanctionをREVOKEDへ変更 | DONE |
| 14 | Audit LogへsanctionIdを記録 | DONE |
| 15 | モデレーションタイムラインへSanctionを統合 | DONE |
| 16 | 実際のAudit action名 `USER_STATUS_CHANGE` をタイムライン対象へ修正 | DONE |
| 17 | 期限超過ACTIVE Sanctionを表示上EXPIREDとして扱う | DONE |
| 18 | ADMINユーザー詳細でSanction履歴を取得 | DONE |
| 19 | ADMINユーザー詳細へ処分履歴UIを追加 | DONE |
| 20 | Preview migration planを既存39件 + 新migration pendingへ更新 | DONE |
| 21 | migration plan回帰テストを更新 | DONE |
| 22 | sanction timeline単体テストを追加 | DONE |
| 23 | Audit action名不整合の回帰テストを追加 | DONE |
| 24 | sanction schema回帰テストを追加 | DONE |
| 25 | moderation sanction persistence回帰テストを追加 | DONE |
| 26 | sanction履歴UI回帰テストを追加 | DONE |
| 27 | Appeal設計文書を段階導入状態へ更新 | DONE |
| 28 | Preview要件定義へSanction永続化を反映 | DONE |
| 29 | NEXT-041 / NEXT-042をロードマップへ追加 | DONE |
| 30 | ADMIN直接status変更でもSanctionを永続化 | DONE |
| 31 | ADMIN直接status変更の回帰テストを追加 | DONE |
| 32 | ADMIN status E2EでSanction有効/解除履歴を確認 | DONE |
| 33 | Preview migration許可branchを今回feature branchへ切替 | DONE |
| 34 | Preview seed許可branchをmigration guardと共通化 | DONE |
| 35 | Preview DB preflightを既存39 migration適用後schemaへ更新 | DONE |
| 36 | Preview DB verifyへSanction table/column検証を追加 | DONE |
| 37 | 今回releaseでhistorical baselineを禁止 | DONE |
| 38 | migration前のfeature branch Vercel deployを明示停止 | DONE |
| 39 | Preview deploy checklist / branch情報を現行化 | DONE |
| 40 | PR CI / E2Eで最終検証 | DONE |

NEXT-041 / PR #48 は共有Preview DB migration・Preview受入・main統合まで完了。merge commit: `f4ce31ba322d8b6b6aa1f6e1241ceb509e8066b2`。
NEXT-042 はPR #48を土台にした別branchで実装を進め、Preview DBへの実適用はSanction migrationの受入順序を崩さない。

### バッチ6検証

- commit: `f86c527ca88e2c3f37281c104284960f6ac0ca99`
- Security integration CI run `36355224790`: SUCCESS
  - unit tests: **153 / 153 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E run `36355224603`: SUCCESS
  - isolated PostgreSQLへの全migration適用: PASS
  - Preview seed: PASS
  - Playwright: **15 / 15 PASS**
  - ADMIN status変更時のSanction有効/解除履歴を含む



## 2026-09-28 実装バッチ7: Sanction Appeal

対象branch: `feature/sanction-appeals-20260928`
依存: PR #48 / NEXT-041（共有Preview受入・main統合済み）

| # | 内容 | Status |
|---:|---|---|
| 1 | Sanction Appeal用 `AppealStatus` enumを追加 | DONE |
| 2 | `Appeal` modelを追加 | DONE |
| 3 | `Appeal.sanctionId` を1対1外部キー化 | DONE |
| 4 | UserへAppeal user/reviewer relationを追加 | DONE |
| 5 | SanctionへAppeal relationを追加 | DONE |
| 6 | Appeal migrationを追加 | DONE |
| 7 | Appeal migrationをdeferredとしてPreview計画へ追加 | DONE |
| 8 | 停止中ユーザー向けpublic `/appeal` を追加 | DONE |
| 9 | メール＋パスワード再認証を追加 | DONE |
| 10 | Appeal経路では通常ログインsessionを作らない | DONE |
| 11 | Appeal認証へrate limit / dummy hashを追加 | DONE |
| 12 | 投稿制限・停止の現在有効Sanctionだけを新規申立て対象化 | DONE |
| 13 | 1 Sanction 1 AppealをDB uniqueで保証 | DONE |
| 14 | 新規AppealをAudit Logへ記録 | DONE |
| 15 | 既存Appealの審査状況再確認を追加 | DONE |
| 16 | 状況確認だけなら理由再入力不要に変更 | DONE |
| 17 | ログイン画面からAppeal導線を追加 | DONE |
| 18 | staff用Sanction Appeal審査Actionを追加 | DONE |
| 19 | Appeal自己審査を禁止 | DONE |
| 20 | Sanction発行者による審査を禁止 | DONE |
| 21 | MODERATORのstaff対象Appeal審査を禁止 | DONE |
| 22 | Appeal維持処理を追加 | DONE |
| 23 | Appeal取消でSanctionをREVOKED化 | DONE |
| 24 | より新しい有効Sanctionがある場合はUser.statusを解除しない | DONE |
| 25 | 取消時のUser.status ACTIVE復帰を追加 | DONE |
| 26 | 審査結果Audit Logを追加 | DONE |
| 27 | 審査結果メール通知を追加 | DONE |
| 28 | staff用Appeal検索 / status filter / paginationを追加 | DONE |
| 29 | 既存Warning Appeal画面からSanction Appeal画面への導線を追加 | DONE |
| 30 | account deletion時にAppeal本文を匿名化 | DONE |
| 31 | account exportへSanction / Appeal履歴を追加 | DONE |
| 32 | moderation timelineへSanction Appeal審査結果を追加 | DONE |
| 33 | Preview seed再実行時にSanction / Appeal状態を初期化 | DONE |
| 34 | Appeal専用E2E Admin 4 / Admin 5を追加し処分発行者と審査者を分離 | DONE |
| 35 | stacked branchのVercel Preview自動deployを明示停止 | DONE |
| 36 | Appeal schema / auth / review安全境界の回帰テストを追加 | DONE |
| 37 | account deletion privacy回帰テストを追加 | DONE |
| 38 | account export privacy回帰テストを追加 | DONE |
| 39 | 停止→Appeal→取消→再ログインE2Eを追加 | DONE |
| 40 | Appeal専用ユーザーを追加し既存social E2Eから状態を分離 | DONE |
| 41 | 停止ログイン失敗時のalert locatorをNext route announcerから分離 | DONE |
| 42 | 本人確認後に処分理由・期限を確認してから申立てるE2Eを追加 | DONE |
| 43 | ADMINユーザー詳細へSanction Appeal履歴を統合 | DONE |
| 44 | モデレーションTOPへ未審査Sanction Appeal件数を追加 | DONE |
| 45 | 審査結果メール送信をE2Eで検証 | DONE |
| 46 | 停止中Appeal routeがpublicのままであることを回帰テスト | DONE |
| 47 | 停止AppealフローのCI / E2E検証 | DONE |
| 48 | 投稿制限→設定Appeal→独立審査→取消→投稿再開E2Eを追加 | DONE |
| 49 | 投稿制限・停止の両Appealを含むPR #49最終CI / E2E | DONE |

Sanction migrationの共有Preview受入が完了したため、Appeal migrationを次のPreview pending migrationへ昇格する。


### バッチ7検証

- code commit: `ceb5d93318a94a17ba79990685400882354f9c84`
- Security integration CI run `36370678553`: **SUCCESS**
  - unit tests: **169 / 169 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E run `36370678559`: **SUCCESS**
  - isolated PostgreSQLへの全migration適用: PASS
  - Preview seed: PASS
  - Playwright: **16 / 16 PASS**
  - 停止ユーザーの処分内容確認: PASS
  - 停止中のSanction Appeal送信: PASS
  - 処分発行者とAppeal審査者の分離: PASS
  - Appeal取消によるSanction解除 / 再ログイン: PASS
  - 審査結果メール通知: PASS

NEXT-042 はコード実装・隔離DB検証まで完了。
共有Preview DBはSanction migration適用済み40 migrationの状態。次は `20260928110500_add_sanction_appeals` のPreview release gateを実行する。


### バッチ7追加検証対象

`POST_RESTRICTION` についても実ブラウザE2Eへ追加:

- 制限中は既存sessionを維持
- 投稿試行を拒否し、制限理由を表示
- 設定画面から `/appeal` へ遷移
- Sanction Appealを送信
- Sanction発行者とは別のADMINが取消審査
- 結果メールを確認
- 取消後に投稿を再開できることを確認


### バッチ7 最終検証（投稿制限 + 停止）

- validated commit: `d588466f4eee95ebfa3f234ca23ef91d75a50ece`
- Security integration CI run `36371259057`: **SUCCESS**
  - unit tests: **169 / 169 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E run `36371259021`: **SUCCESS**
  - isolated PostgreSQLへの全migration適用: PASS
  - Preview seed: PASS
  - Playwright: **16 / 16 PASS**
  - SUSPENSION: 処分内容確認 → Appeal → 独立審査 → 取消 → 結果メール → 再ログイン: PASS
  - POST_RESTRICTION: 投稿拒否 → 設定Appeal → 独立審査 → 取消 → 結果メール → 投稿再開: PASS

NEXT-042 のコード実装と隔離環境検証は完了。
共有PreviewへのAppeal migrationはSanction受入済み状態をpreflightで確認したうえで実施する。


## 2026-09-28 PR #48 main統合・Appeal Previewリリース準備

### Sanction release完了

- PR #48: **MERGED**
- main merge commit: `f4ce31ba322d8b6b6aa1f6e1241ceb509e8066b2`
- shared Preview DB: **40 migrations applied**
- `Sanction` schema: verified
- Sanction Preview deployment: `dpl_7ksKuNtxd9oaJzj3vmgJKeePpMNZ` READY
- public HTTP smoke: **5 / 5 PASS**
- runtime error/fatal: **0**
- Production auto-deploy: **disabled**
- Production DB / deployment: **untouched / HOLD**

### NEXT-042 release gate

PR #49を `main` baseへ付け替え、Appeal release safetyを次の状態へ更新する。

- historical migrations: **40**（Sanction migrationを含む）
- pending migration: `20260928110500_add_sanction_appeals`
- deferred migrations: **0**
- preflight: `Sanction` が存在し、`Appeal` が存在しないことを要求
- post-migration verify: `Appeal` table / columns / migration historyを要求
- Preview migration / seed許可branch: `feature/sanction-appeals-20260928`
- Appeal branch Vercel auto-deploy: migration受入前は **disabled**
- Production: **HOLD**

次のゲートは、PR #49最新headのCI / E2E成功 → Neon一時branch migration検証 → 明示承認後に共有PreviewへAppeal migration適用。


## 2026-09-28 Appeal共有Preview受入

### DB / migration

- rollback branch: `backup-before-appeal-migration-2026-09-28`
- applied migration: `20260928110500_add_sanction_appeals`
- Prisma migration history: **41 applied**
- `Sanction` table: present
- `Appeal` table: present
- `AppealStatus`: `PENDING / UPHELD / OVERTURNED`
- Appeal indexes: **5**
- Appeal foreign keys: **3**
- `Appeal_sanctionId_key`: verified
- shared Preview `Sanction` / `Appeal` rows at acceptance: **0 / 0**

### migration dry run

Neon temporary branchで以下を確認済み。

- Appeal作成: PASS
- PENDING → OVERTURNED更新: PASS
- reviewer / reviewedAt / resolutionNote更新: PASS
- Sanction削除時のAppeal CASCADE削除: PASS
- shared Preview parentはdry run中も未変更: PASS

### Preview deployment

- validated Preview commit: `a8ae408eb312bdf212333c0d641e6fc6b084b0a2`
- deployment: `dpl_HYXTdW7t9cCrjBzFnsGxBWT1rH3Z`
- state: **READY**
- public smoke:
  - `/`: 200
  - `/login`: 200
  - `/register`: 200
  - `/explore`: 200
  - `/safety`: 200
  - `/appeal`: 200 / Appeal UI present
- runtime error/fatal scan: **0**
- Appeal branch auto-deploy: acceptance後に **disabledへ復帰**
- main auto-deploy: **disabled**
- Production DB / deployment: **untouched / HOLD**

### authenticated flow

- isolated PostgreSQL + Playwright: **16 / 16 PASS**
- SUSPENSION Appeal: PASS
- POST_RESTRICTION Appeal: PASS
- 独立reviewer / overturn / result email / status復帰: PASS
- shared Previewの既存seedは5ユーザーのまま保持
- shared Previewへの追加seedは、認証hashを直接扱う操作が安全チェックで停止したため未実行
- shared Preview上の認証付き手動UI受入は未実施

このためNEXT-042の **DB migration・Preview deployment・公開smokeは完了**。
shared Preview認証付き手動UI受入は、GitHub Preview secretが未設定で自動実行できなかった。既存seed認証情報を直接操作せず、安全上の理由から追加seedは行わない。shared Preview DB 41 migrations / Vercel Preview 6/6 smoke / runtime error 0 / isolated authenticated Playwright 16/16を受入根拠として、この手動確認は重複検証として省略する。


### Shared Preview認証付き手動受入の扱い

一時的にGitHub Actionsからshared Previewへseedし、認証付きSanction Appeal E2Eを実行する経路を検証したが、GitHub側に `PREVIEW_DATABASE_URL` / `PREVIEW_TEST_PASSWORD` secretが未設定だったため開始前に停止した。

- shared Preview DBへの追加書き込み: **なし**
- 既存seed users: **5のまま**
- Sanction / Appeal rows: **0 / 0**
- temporary workflow: **削除済み**
- 既存seed password hash: **未変更**

認証フロー自体はisolated PostgreSQL上のPlaywrightで **16 / 16 PASS**、shared PreviewではDB schema・Vercel runtime・公開routeを別々に受入済み。
このため、shared Previewでの重複した手動ログイン操作はmain統合の必須条件から外す。
Production releaseは引き続きHOLD。


## 2026-09-28 PR #49 main統合完了

- PR #49: **MERGED**
- main merge commit: `fc935925c4bb0e11630063eb83839f69ee68bc2b`
- shared Preview DB: **41 migrations applied**
- `Sanction` / `Appeal` schema: verified
- Appeal Preview deployment: `dpl_HYXTdW7t9cCrjBzFnsGxBWT1rH3Z` READY
- public smoke: **6 / 6 PASS**
- `/appeal`: 200 / UI present
- Preview runtime error/fatal: **0**
- feature branch auto-deploy: **disabled**
- main auto-deploy: **disabled**
- Production DB / deployment: **untouched / HOLD**

### Final PR head validation

Final PR head: `d4005a0c9ff59b37715626c0087f4653284c8dac`

- Security integration CI `36380072032`: **SUCCESS**
  - unit tests: **173 / 173 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E `36380071956`: **SUCCESS**
  - isolated PostgreSQL migrations: PASS
  - Preview seed: PASS
  - Playwright: **16 / 16 PASS**

### main merge後 validation

- Security integration CI `36380347132`: **SUCCESS**
  - unit tests: **173 / 173 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E `36380347130`: **SUCCESS**
  - Playwright: **16 / 16 PASS**
- main mergeによるVercel Production deployment: **発生なし**

NEXT-041 / NEXT-042のSanction + Sanction Appeal release系列はmain統合まで完了。
Production releaseは別工程として **HOLD** を維持する。


## 2026-09-28 NEXT-038 cleanup inventory

PHASE-G / NEXT-038 は統合後整理フェーズ。

### GitHub branches

mainとの比較結果:

#### 削除してよい候補

- `feature/sanction-records-20260928`
  - ahead of main: **0**
  - behind main: 90
  - PR #48 merge済み
- `feature/sanction-appeals-20260928`
  - ahead of main: **0**
  - behind main: 3
  - PR #49 merge済み
- `security-integration-final-20260926`
  - ahead of main: **0**
  - behind main: 131
  - 統合済みfinal branch

現在のGitHub connectorにはbranch削除actionがないため、上記branchは未削除。

#### 自動削除しない

- `security-integration-20260926`: mainに対して11 commits aheadのdiverged branch
- `security-hardening-20260926`: mainに対して42 commits aheadのdiverged branch
- その他旧security作業branch

これらは履歴差分を確認せず削除しない。

### Neon branches

#### 保持

- `production` / `br-late-field-b3ixoym5`
- `backup-before-sanction-migration-2026-09-28` / `br-wandering-bonus-b3fwuc0n`
- `backup-before-appeal-migration-2026-09-28` / `br-billowing-lab-b3xo361l`

2本のbackup branchはProduction release前のrollback pointとして保持。

#### 削除候補

- `mcp-migration-2026-09-27T21-09-15` / `br-gentle-morning-b34ef1bw` — **削除済み**
- `mcp-migration-2026-09-26T23-35-13` / `br-broad-surf-b3z9ya0v` — **削除済み**

2026-09-28 明示承認後に削除し、再一覧で存在しないことを確認済み。

### NEXT-038 completion condition

- 上記2本のNeon一時migration branchを削除
- GitHubのahead=0済みbranchをUI等で削除、または保持理由を明記
- rollback用backup branchはProduction release完了まで保持

それまでは NEXT-038 / PHASE-G を **IN PROGRESS** とする。
Production release（NEXT-039 / NEXT-040）は引き続き **HOLD**。


### Neon cleanup実施結果

2026-09-28、明示承認後に以下の一時migration branchを削除。

- `br-gentle-morning-b34ef1bw` / `mcp-migration-2026-09-27T21-09-15`: **DELETED**
- `br-broad-surf-b3z9ya0v` / `mcp-migration-2026-09-26T23-35-13`: **DELETED**

削除後のNeon branchは3本のみ。

- `production` / `br-late-field-b3ixoym5`
- `backup-before-sanction-migration-2026-09-28` / `br-wandering-bonus-b3fwuc0n`
- `backup-before-appeal-migration-2026-09-28` / `br-billowing-lab-b3xo361l`

rollback用backup 2本はProduction release完了まで保持。

NEXT-038の残作業はGitHub上のahead=0済みbranch 3本の削除のみ。
現在のGitHub connectorにはbranch delete actionがないため、UIでの手動削除待ち。


### NEXT-039 preparation

- `docs/PRODUCTION_RELEASE_RUNBOOK.md` を追加
- Production identity gateを明文化
- Production backup / restore gateを明文化
- Production migration history差分確認を必須化
- Production cloneでのmigration dry runを必須化
- DB migrationとVercel deploymentを別承認ゲート化
- post-deploy smoke / runtime error / rollback判断を明文化
- Production DB / deploymentへの実操作: **未実施**

NEXT-039はrunbook準備済みだが、Production identity確認前のため **HOLD** を維持する。


## 2026-09-28 PR #50 / Production preflight safety

### main統合

- PR #50: **MERGED**
- merge commit: `0b39d89c5957df7d66fb4c2cc83aea909d82cc3e`
- `src/lib/productionMigrationSafety.ts`: added
- `scripts/production-db-preflight.ts`: added
- `npm run production:db:preflight`: added
- shared Preview hostをProductionとして扱うことを明示拒否
- Production host / database nameの完全一致を必須化
- Production preflightはread-only
- Prisma migrate / deploy処理: **なし**

### TDD / validation

RED:

- Production safety module不存在: expected FAIL
- Production preflight command不存在: expected FAIL

GREEN final PR head:

- Security integration CI `36382800494`: **SUCCESS**
  - unit tests: **182 / 182 PASS**
  - Prisma validate / generate: PASS
  - lint: PASS
  - TypeScript: PASS
  - Next.js build: PASS
- CoCo E2E `36382800477`: **SUCCESS**
  - isolated PostgreSQL migration / seed: PASS
  - Playwright: **16 / 16 PASS**

main merge後:

- Security integration CI `36383159273`: **SUCCESS**
  - unit tests: **182 / 182 PASS**
- CoCo E2E `36383159204`: **SUCCESS**
  - Playwright: **16 / 16 PASS**
- mergeによる新規Vercel Production deployment: **発生なし**
- `main` auto-deploy: **disabled**

### Current Production observation

Current aliased Production:

- deployment: `dpl_8U7SN8AU6fonvRq7fYsALJGwAzCb`
- commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- created: **2026-09-26 18:58 JST**
- current mainとの差: **1215 commits**
- deployed commit migration dirs: **28**
- current main migration dirs: **41**
- maximum apparent migration delta: **13**
- actual Production migration history: **未確認**

Read-only Production smoke:

- public pages: **4 / 4 HTTP 200**
- DB-backed API reads: **2 / 2 HTTP 200**
- 5xx / schema error: **0**
- pg SSL compatibility warning: **1**

Production DB identityは未特定。
既存Vercel `DATABASE_URL (All Environments)` の接続先を確認できるまでは、backup / dry run / migrationを実行しない。

NEXT-039は **IN PROGRESS（read-only identity gate）**。
NEXT-040 Production releaseは引き続き **HOLD**。


### NEXT-039 Production baseline

読み取り専用確認を実施。

- current Production deployment: `dpl_8U7SN8AU6fonvRq7fYsALJGwAzCb`
- current Production commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- Production public smoke: **5 / 5 current routes PASS**
- `/appeal`: 404（現Production commitでは未実装のため想定どおり）
- `/api/feed?limit=1`: 200
- current Production DB connectivity: confirmed through app
- Preview seed handles 5件をProduction APIで照合: **5 / 5 not found**
- shared Preview DB誤接続の兆候: **なし**
- current Production code migration count: **28**
- main migration count: **41**
- code-level migration delta: **13 candidate migrations**
- actual Production DB `_prisma_migrations`: **未取得**
- exact Production DB host / database name: **未特定**
- Production DB write: **未実施**
- Production deploy: **未実施**

PR #50でProduction read-only preflight safetyをmainへ追加済み。

- PR #50 merge commit: `0b39d89c5957df7d66fb4c2cc83aea909d82cc3e`
- main post-merge Security CI: **182 / 182 PASS**
- main post-merge Playwright: **16 / 16 PASS**

NEXT-039はProduction identity gate待ち。
NEXT-040 / Production releaseは引き続き **HOLD**。


### NEXT-039 current blocking gate

自動で確認できた内容:

- Production deployment: identified
- Production public baseline: recorded
- Production DB connectivity through deployed app: confirmed
- shared Preview DBとのデータ分離: confirmed by 5 known Preview handles
- Production deployed-code migration baseline: 28
- main migration files: 41
- candidate delta: 13
- Production read-only preflight implementation: merged / green

現在の唯一のblocking gate:

- exact Production DB endpoint host
- exact Production database name
- actual Production `_prisma_migrations` history

Vercel connectorはProduction環境変数の値を公開しないため、上記identityは現接続から自動取得できない。
host / DB名を推測してmigrationを実行してはならない。

NEXT-039は **IN PROGRESS**。
NEXT-040（Production migration / deploy）は **HOLD**。


### NEXT-039 Production migration risk audit

`docs/PRODUCTION_MIGRATION_AUDIT_2026-09-28.md` を追加。

- 13 candidate migrations: reviewed
- destructive data-loss migration: **1**
  - `20260928013000_remove_reply_and_quote_post`
- existing-row rewrite / potential write-blocking migration: **1**
  - `20260927002000_add_follow_approval`
- remaining additive migrations: **11**
- required pre-migration row counts: defined
- Production dry-run acceptance criteria: defined
- stop conditions: defined

特にReply rowsまたはnon-null quotePostIdが存在する場合は、自動migrationを停止してデータ処理方針を先に決める。

Production identity / actual migration historyは引き続き未取得。
