# CoCo Appeal モデル設計方針

最終更新: 2026-09-28

## 現状

現在は `ModerationWarning` と `WarningAppeal` が1対1で結び付いており、警告については異議申立て、維持、取消、審査理由、監査ログまで実装済み。

投稿制限とアカウント停止は `User.status` と期限フィールドで表現されており、「処分そのもの」を示す独立した永続レコードがない。

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
