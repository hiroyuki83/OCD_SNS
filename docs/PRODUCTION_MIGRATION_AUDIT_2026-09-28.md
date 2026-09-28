# CoCo Production Migration Audit

最終更新: 2026-09-28

対象:
- current Production deployed commit: `1c57373d476a904942d4509354dfa3723d6192aa`
- current main: 41 Prisma migrations
- code-level candidate delta: 13 migrations

重要:
この監査は **コード上の差分監査**。
Production DBの実際の `_prisma_migrations` をまだ取得していないため、下記13件をそのままProduction pendingと断定しない。

## Summary

13件のうち、特にProduction適用前確認が必要なのは以下。

### HIGH — destructive data-loss gate

`20260928013000_remove_reply_and_quote_post`

実行内容:

- `DROP TABLE IF EXISTS "Reply"`
- `Post_quotePostId_fkey` をDROP
- `Post.quotePostId` をDROP

Productionに既存Reply行、または非NULLのquotePostIdがある場合、それらは不可逆に失われる。

Production適用前に必ずread-onlyで確認:

```sql
SELECT count(*) AS reply_rows
FROM "Reply";

SELECT count(*) AS quoted_posts
FROM "Post"
WHERE "quotePostId" IS NOT NULL;
```

停止条件:

- `reply_rows > 0`
- `quoted_posts > 0`

どちらかが真なら自動migrationを行わず、データ保存・export・仕様判断を先に行う。

現在Productionへ出ているPrisma schemaには `Reply` model と `Post.quotePostId` が存在する。

### MEDIUM — existing-row rewrite / write-blocking gate

`20260927002000_add_follow_approval`

実行内容:

- `Follow.acceptedAt` nullable column追加
- 既存Follow全行について `acceptedAt = createdAt`
- `Follow` に通常INDEXを2本作成

注意点:

- 全Follow行をUPDATEする
- 通常の `CREATE INDEX` はデータ量によって時間がかかり、書き込みを阻害する可能性がある
- ProductionのFollow件数が大きい場合はmaintenance windowまたは別migration方式を検討する

Production適用前に必ずread-onlyで確認:

```sql
SELECT count(*) AS follow_rows
FROM "Follow";
```

停止/再設計検討条件:

- Follow件数が想定より大きい
- migration dry runで所要時間やlockが許容範囲を超える

## LOW / additive migrations

以下は基本的に追加型。

### `20260926103000_add_restriction_until`

- User nullable timestamp追加
- data rewriteなし

### `20260926104500_add_warning_appeal`

- WarningAppeal新規table
- unique/index/FK追加
- 既存tableデータ変更なし

### `20260926111500_add_appeal_review`

- enum追加
- ModerationWarning nullable column追加
- WarningAppealへstatus/review columns追加
- statusはDEFAULT PENDING
- WarningAppeal既存件数がある場合は既存行がPENDING扱いになる

確認推奨:

```sql
SELECT count(*) AS warning_appeals
FROM "WarningAppeal";
```

### `20260926120000_add_session_version`

- UserにNOT NULL DEFAULT 0
- 全既存userがsessionVersion 0になる

### `20260926123000_add_staff_totp`

- UserにTOTP用nullable columns追加
- 既存userデータ変更なし

### `20260926124500_add_staff_recovery_codes`

- 新規table/index/FK
- 既存tableデータ変更なし

### `20260928014500_add_post_image_alt`

- Post nullable text column追加
- data rewriteなし

### `20260928023000_add_notification_preferences`

- Userに3 boolean NOT NULL DEFAULT true
- 既存userはすべてtrueから開始

### `20260928031500_add_email_change_pending`

- EmailVerificationToken nullable text column追加
- data rewriteなし

### `20260928071000_add_sanction_records`

- enum 2個追加
- Sanction新規table/index/FK
- 既存User/Reportデータ変更なし
- 新tableはmigration時点では空

### `20260928110500_add_sanction_appeals`

- enum追加
- Appeal新規table/index/FK
- `Appeal.sanctionId` unique
- 既存Sanction/Userデータ変更なし
- Sanction migrationが先に必要

## Dependency order

Prisma migration順を崩さない。

特に:

1. warning appeal table
2. warning appeal review columns
3. staff TOTP columns
4. recovery-code table
5. follow approval
6. reply / quote removal
7. image alt
8. notification prefs
9. pending email
10. Sanction
11. Appeal

Sanction AppealはSanctionより前に適用しない。

## Production read-only query pack

Production identity gate通過後、migration dry run前に以下を取得する。

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
ORDER BY started_at;

SELECT count(*) AS user_rows FROM "User";
SELECT count(*) AS post_rows FROM "Post";
SELECT count(*) AS follow_rows FROM "Follow";

SELECT
  CASE
    WHEN to_regclass('public."Reply"') IS NULL THEN NULL
    ELSE (SELECT count(*) FROM "Reply")
  END AS reply_rows;

SELECT count(*) AS quoted_posts
FROM "Post"
WHERE "quotePostId" IS NOT NULL;
```

注:
最後のqueryは `quotePostId` columnが存在することをschema確認後にのみ実行する。

## Production dry-run acceptance criteria

Production clone / temporary branchで:

- pending migrationsが順番通りすべて成功
- migration historyにfailed/rolled-back entryなし
- Reply / quote削除前データ件数が0、または明示的なデータ処理方針あり
- Follow migrationの実行時間とlockが許容範囲
- User / Post / Follow等の件数が意図せず減少しない
- login / feed / moderation / appeal schemaが整合
- Prisma validate / generateとmain buildが一致

## Current status

- code migration audit: COMPLETE
- Production deployed-code baseline: 28 migrations
- main: 41 migrations
- candidate delta: 13
- destructive migration identified: 1
- row-rewrite migration identified: 1
- actual Production migration history: unresolved
- exact Production DB identity: unresolved
- Production migration: NOT STARTED
- Production deploy: NOT STARTED
