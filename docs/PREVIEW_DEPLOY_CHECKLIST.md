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

## 停止条件

以下のどれかが不明ならDB migration / seedを実行しない。
- 接続先DBがPreviewか不明
- ProductionとPreviewのURL区別ができない
- migration対象schemaが不明
- backup / restore経路が確認できない
