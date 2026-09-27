# CoCo DB / Blob バックアップ・復旧方針

最終更新: 2026-09-28

## 目的

障害、誤操作、migration失敗、データ破損が起きたときに、Production と Preview を混同せず復旧できる状態を維持する。

## PostgreSQL / Neon

- Production と Preview は別DBまたは別Neon branchとして分離する。
- Preview の接続文字列を Production に設定しない。
- Production migration 前に、Neon の point-in-time restore / branch restore が利用可能な状態を確認する。
- 破壊的 migration の直前には復旧基点を確認する。
- Production DB への手動 destructive SQL は通常運用にしない。
- schema変更は Prisma migration としてGitで履歴管理する。

### 復旧判断

1. アプリだけの不具合ならDBを戻さずアプリをrollbackする。
2. migrationによるデータ破損が疑われる場合は書き込みを抑制する。
3. 復旧用branch / snapshotでデータを検証する。
4. Productionを直接試行錯誤の場にしない。
5. 復旧後に件数・主要relation・ログイン・投稿・モデレーション動作を確認する。

## Vercel Blob

投稿画像・プロフィール画像・ヘッダー画像はDB URLとBlob本体の両方が必要。
- Blob URLをDBバックアップだけで完全復旧できるとは考えない。
- Blob削除はDB更新成功後に行う。
- upload後にDB保存が失敗した場合は孤立Blobを削除する。
- アカウント削除を実装する場合、Blob削除失敗時の再試行方針を別途持つ。

## 復旧スモークテスト

- / が表示できる
- /login が表示できる
- ログインできる
- 投稿一覧が読める
- 新規投稿ができる
- private account の可視性が守られる
- block が守られる
- moderator/admin の認可が守られる
- 心理セルフチェックは本人だけが読める
- 画像URLが有効
- 通報・警告履歴が読める

## 保持と削除

バックアップ保持期間はインフラ契約・運用要件に合わせて決める。
ユーザー向けアカウント削除を実装する際は「本体DBからの削除」と「バックアップから自然消滅するまでの期間」を区別して説明する。

## 定期復旧テスト

Productionデータそのものを不用意に複製せず、Previewまたは専用検証branchで復旧手順を定期確認する。

- 実施日
- 復旧元
- 復旧先
- schema version
- 所要ステップ
- smoke test結果
- 問題点
