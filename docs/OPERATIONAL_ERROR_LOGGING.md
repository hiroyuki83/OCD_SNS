# CoCo 運用エラー記録方針

最終更新: 2026-09-28

## 基本方針

ユーザー入力や例外メッセージを、そのまま運用ログへ出さない。
アプリケーション内部エラーは、必要最小限の識別情報だけを記録する。

## 記録する項目

- incidentId
- event
- errorName
- occurredAt

## 記録しない項目

- パスワード
- メール本文
- 心理セルフチェック回答
- 投稿本文
- 通報詳細
- TOTP秘密鍵
- recovery code
- reset / verification token
- 例外stack全文
- 例外message全文

## ユーザー向け表示

内部エラーの詳細は画面へ出さず、必要に応じて incidentId または Next.js digest を表示する。

## 現在の実装

- src/lib/operationalError.ts
- src/instrumentation.ts (`onRequestError`)
- src/app/error.tsx
- src/app/global-error.tsx
- account export失敗時は incidentId を返す
- Blob削除、認証ユーザー検索、メール再送/メール変更送信の失敗も privacy-safe logger を使用する

## 将来の外部監視連携

Sentry等の外部監視を導入する場合も、送信前にPII・心理検査データ・投稿本文を除外する。
外部サービスへ送るフィールドは明示的allowlist方式にする。
