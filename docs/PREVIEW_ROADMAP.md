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
| NEXT-007 | Preview DB migration / seed / smoke test | P0 | TODO |
| NEXT-008 | Playwright E2E 基盤導入 | P0 | IN PROGRESS |
| NEXT-009 | 登録→確認→ログイン E2E | P0 | IN PROGRESS |
| NEXT-010 | private follow approval E2E | P0 | IN PROGRESS |
| NEXT-011 | block / mute E2E | P0 | IN PROGRESS |
| NEXT-012 | 投稿 / リアクション / bookmark / 削除 E2E | P0 | IN PROGRESS |
| NEXT-013 | 通報→moderation→警告 E2E | P0 | IN PROGRESS |
| NEXT-014 | 警告→異議申立て→審査 E2E | P0 | IN PROGRESS |
| NEXT-015 | ADMIN role / status change E2E | P0 | IN PROGRESS |
| NEXT-016 | staff TOTP / recovery code E2E | P0 | IN PROGRESS |
| NEXT-017 | session revoke E2E | P0 | IN PROGRESS |
| NEXT-018 | 心理検査データのアクセス権仕様を明文化 | P0 | DONE |
| NEXT-019 | 心理検査データを管理画面から原則参照不可にする確認 / 修正 | P0 | DONE |
| NEXT-020 | アカウント削除 | P1 | TODO |
| NEXT-021 | ユーザーデータエクスポート | P1 | DONE |
| NEXT-022 | メールアドレス変更 | P1 | TODO |
| NEXT-023 | 通常のパスワード変更 | P1 | DONE |
| NEXT-024 | 制裁履歴をユーザー単位で統合表示 | P1 | DONE |
| NEXT-025 | 警告以外の処分への Appeal model を検討 | P1 | TODO |
| NEXT-026 | 異議申立て結果通知 | P1 | TODO |
| NEXT-027 | 通知設定 | P2 | DONE |
| NEXT-028 | ユーザー / @handle 検索 | P2 | DONE |
| NEXT-029 | ハッシュタグ検索 | P2 | DONE |
| NEXT-030 | 画像 alt text | P2 | DONE |
| NEXT-031 | キーボード / focus / screen reader 監査 | P2 | DONE |
| NEXT-032 | アプリレベルのエラー監視 | P2 | IN PROGRESS |
| NEXT-033 | DB / Blob バックアップ・復旧手順の文書化 | P2 | DONE |

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

通常CIとPlaywright E2Eの最新runが成功した時点で NEXT-008〜017 を DONE に更新する。
