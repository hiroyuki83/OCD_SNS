# CoCo Preview Roadmap / Progress Tracker

最終更新: 2026-09-28
対象ブランチ: `security-integration-final-20260926`

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
| NEXT-006 | 最新 Preview branch を Vercel Preview に同期 | P0 | TODO |
| NEXT-007 | Preview DB migration / seed / smoke test | P0 | IN PROGRESS |
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
| NEXT-034 | Preview最終受入確認（主要機能・migration・smoke・runtime error確認） | P0 | TODO |
| NEXT-035 | main統合前ゲート確認（NEXT-006/007/034完了、Production自動deployの有無確認） | P0 | TODO |
| NEXT-036 | PR #47 を main へmerge | P0 | TODO |
| NEXT-037 | main merge後のCI / E2E再確認 | P0 | TODO |
| NEXT-038 | integration branch終了・不要な一時Neon branch整理 | P1 | TODO |
| NEXT-039 | Production release準備（Production DB backup / migration plan / deploy plan） | P0 | HOLD |
| NEXT-040 | Productionへ明示release・post-deploy smoke / error scan | P0 | HOLD |

## リリース進行フェーズ

mainへ統合する位置を、以下のゲートで固定する。

| Phase | 内容 | 完了条件 | Status |
|---|---|---|---|
| PHASE-A | 機能実装 | 要件上の主要機能・セキュリティ・管理機能が実装済み | DONE |
| PHASE-B | ローカル/CI検証 | Prisma / lint / unit / TypeScript / build / Playwright E2E が成功 | DONE |
| PHASE-C | Preview DB同期 | Preview専用DBを特定し、backup/snapshot後にmigration・seedを完了 | IN PROGRESS |
| PHASE-D | Preview最終受入 | 最新commitのVercel Previewでsmoke・主要機能・runtime error確認 | TODO |
| PHASE-E | main統合ゲート | PHASE-C/D完了、Production自動deployの有無と影響を確認 | TODO |
| PHASE-F | mainへ統合 | PR #47をmainへmergeし、main上のCI/E2Eを再確認 | TODO |
| PHASE-G | 統合後整理 | integration branchと不要な一時Neon branchを整理 | TODO |
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

### 現在位置

現在は **PHASE-C / NEXT-007**。

完了済み:
- Preview専用Neon project `coco-preview` を特定
- project ID `plain-dawn-64792117` を確認
- DB `neondb` を確認
- schema差分を確認
- migration前snapshot `before-preview-schema-sync-2026-09-28` を作成

未完了:
- 4本のPreview migration適用
- Preview seed
- 最新commitのVercel Preview同期
- Preview smoke / acceptance
- main merge

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
