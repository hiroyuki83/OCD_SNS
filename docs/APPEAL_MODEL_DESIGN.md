# CoCo Appeal モデル設計方針

最終更新: 2026-09-28

## 現状

現在は `ModerationWarning` と `WarningAppeal` が1対1で結び付いており、警告については異議申立て、維持、取消、審査理由、監査ログまで実装済み。

2026-09-28 の段階導入で、投稿制限とアカウント停止については `Sanction` を第一級の永続レコードとして追加した。現在の `User.status` と期限フィールドは実効状態の高速判定用として維持し、`Sanction` は処分履歴・将来の異議申立て対象を明確にするために使用する。

警告は既存の `ModerationWarning` / `WarningAppeal` をそのまま維持しており、まだ共通 `Appeal` モデルへ移行していない。

## 結論

警告以外へ異議申立てを拡張するとき、`Appeal.subjectType + subjectId` のような文字列参照だけを追加する方法は採用しない。

理由:

- DB外部キーで対象処分の存在を保証できない
- 処分が解除・期限切れになった後の履歴表現が弱い
- 同時更新時の競合制御が複雑になる
- 投稿制限・停止の「どの処分への異議か」が曖昧になる

## 推奨する将来モデル

まず警告・投稿制限・停止を共通の第一級レコードとして表現する `Sanction` を導入し、その後 `Appeal` が `sanctionId` を参照する。

想定:

- SanctionType: WARNING / POST_RESTRICTION / SUSPENSION
- SanctionStatus: ACTIVE / EXPIRED / REVOKED
- targetUserId
- actorUserId
- reportId
- reason
- startsAt
- endsAt
- revokedAt
- Appeal: sanctionId, userId, message, status, reviewerId, reviewedAt, resolutionNote

## 現時点の判断

既存のWarningAppealは安定稼働しているため、今回のPreviewでは無理に共通モデルへmigrationしない。
投稿制限・停止にもユーザー異議申立てを提供する段階で、Sanction + Appealへの段階的migrationを行う。

この設計検討を `NEXT-025` の完了条件とする。実装は別タスクとして管理する。


## 2026-09-28 段階導入状況

### Phase 1: Sanction 永続化

実装済み:

- `SanctionType`: `WARNING / POST_RESTRICTION / SUSPENSION`
- `SanctionStatus`: `ACTIVE / EXPIRED / REVOKED`
- 投稿制限・停止時に `Sanction` を作成
- 新しい処分で置き換える際、過去の有効処分を `REVOKED` として履歴保存
- 期限を過ぎた既存処分を `EXPIRED` として整理
- ADMINユーザー詳細で処分履歴を表示
- モデレーション統合タイムラインへSanctionを統合

### Phase 2: Sanction Appeal

`feature/sanction-appeals-20260928` で実装中:

- `Appeal` model と `sanctionId` 外部キー
- 投稿制限・停止に対するユーザー異議申立て
- 停止中でも利用できる、通常セッションを作らない本人確認付き `/appeal`
- staff審査による維持 / 取消
- 自分自身の申立て、または自分が出した処分の審査禁止
- 取消時に、より新しい有効処分が無い場合だけ `User.status` を `ACTIVE` に戻す
- 審査結果のメール通知
- アカウントexport / 削除時匿名化 / 管理タイムラインへの統合

現時点では警告の `ModerationWarning` / `WarningAppeal` は既存系を維持する。
Appeal migrationはSanction migrationのPreview受入前には実適用せず、deferred migrationとして管理する。
