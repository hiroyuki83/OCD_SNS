# CoCo Preview 要件定義

最終更新: 2026-09-28
対象基準ブランチ: `main`
現在の実装ブランチ: `feature/sanction-appeals-20260928`

この文書を CoCo Preview 版の仕様上の正本（source of truth）とする。
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

### 返信・引用についての既存コード

過去の実装由来で Prisma schema 等に以下が残っている。

- `Reply` model
- `Post.quotePostId`
- `Post.quotePost`
- `Post.quotedBy`

これらは正式仕様ではないため、後続タスクで削除する。

削除時は以下を確認する。

- Prisma schema から関連 model / relation / field を削除
- 関連 migration を新規作成
- 古い UI / API / helper の参照があれば削除
- build / lint / typecheck / test を通す
- Preview DB で migration を確認する

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

今後検討:
- 投稿制限解除
- アカウント停止解除
- 通知カテゴリごとの ON / OFF

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

現段階では POST_RESTRICTION / SUSPENSION を `Sanction` に保存する。警告は既存の `ModerationWarning` を正本として維持し、共通Appeal導入時に段階移行する。

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

警告以外の処分への拡張方針は `APPEAL_MODEL_DESIGN.md` を正本とする。投稿制限・停止は `Sanction` を正本とし、`Appeal.sanctionId` で申立て対象を一意に参照する。

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

Appeal migrationはSanction migrationのPreview受入まではdeferredとして扱い、共有Preview DBへ同時適用しない。

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

Preview と Production の DB を分離する。

### DB構成

常設DBは原則として以下の2系統とする。

- Production DB
- 共有Preview DB（Neon project: `coco-preview`）

PRごとに恒久DBを作成しない。
schema変更・破壊的migrationの検証が必要な場合のみ一時的なNeon branchを作成し、検証完了またはPR終了後に削除する。

Preview seed は以下の条件を満たす場合のみ実行する。

- `VERCEL_ENV=preview`
- `PREVIEW_SEED_USERS=1`
- `DATABASE_URL === PREVIEW_DATABASE_URL`

Production DB に Preview seed を実行してはならない。

Neon project `coco-preview` 内のdefault branch名が `production` であっても、それはPreview専用project内のbranchであり、CoCo Production DBとは別物として扱う。
運用上の誤認を減らすため、将来的にPreview側default branch名は `preview` へ変更する。

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
2. 最新commitがVercel Previewへ同期済み
3. Preview DB migrationが成功
4. Preview seedが成功
5. Preview smoke testが成功
6. 主要機能のPreview受入確認が成功
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
