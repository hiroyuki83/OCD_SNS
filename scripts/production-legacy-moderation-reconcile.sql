BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $reconcile_guard$
DECLARE
  row_count_value BIGINT;
  enum_values TEXT[];
  active_legacy_migration_count INTEGER;
  restriction_migration_count INTEGER;
  notification_type_columns INTEGER;
BEGIN
  IF to_regclass('public."ModerationAction"') IS NULL THEN
    RAISE EXCEPTION 'Expected legacy ModerationAction table is missing';
  END IF;

  IF to_regclass('public."Appeal"') IS NULL THEN
    RAISE EXCEPTION 'Expected legacy Appeal table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Appeal'
      AND column_name = 'sanctionId'
  ) THEN
    RAISE EXCEPTION 'Appeal already looks like the current Sanction Appeal schema';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Appeal'
      AND column_name = 'moderationActionId'
  ) THEN
    RAISE EXCEPTION 'Appeal is not the expected legacy moderation schema';
  END IF;

  IF to_regclass('public."ModerationWarning"') IS NOT NULL
     OR to_regclass('public."WarningAppeal"') IS NOT NULL
     OR to_regclass('public."Sanction"') IS NOT NULL THEN
    RAISE EXCEPTION 'Current moderation schema is already partially present';
  END IF;

  SELECT count(*) INTO row_count_value FROM "ModerationAction";
  IF row_count_value <> 0 THEN
    RAISE EXCEPTION 'ModerationAction contains % rows', row_count_value;
  END IF;

  SELECT count(*) INTO row_count_value FROM "Appeal";
  IF row_count_value <> 0 THEN
    RAISE EXCEPTION 'Legacy Appeal contains % rows', row_count_value;
  END IF;

  SELECT count(*) INTO row_count_value
  FROM "Notification"
  WHERE "type"::text = 'MODERATION';
  IF row_count_value <> 0 THEN
    RAISE EXCEPTION 'MODERATION notifications contain % rows', row_count_value;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'restrictionUntil'
  ) THEN
    RAISE EXCEPTION 'Expected User.restrictionUntil is missing';
  END IF;

  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_values
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'AppealStatus';

  IF enum_values IS DISTINCT FROM ARRAY['OPEN','REVIEWING','UPHELD','OVERTURNED']::TEXT[] THEN
    RAISE EXCEPTION 'Unexpected legacy AppealStatus values: %', enum_values;
  END IF;

  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_values
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'ModerationActionType';

  IF enum_values IS DISTINCT FROM ARRAY[
    'WARNING',
    'POST_HIDDEN',
    'POST_RESTORED',
    'POST_RESTRICTED',
    'ACCOUNT_SUSPENDED',
    'ACCOUNT_RESTORED'
  ]::TEXT[] THEN
    RAISE EXCEPTION 'Unexpected ModerationActionType values: %', enum_values;
  END IF;

  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
  INTO enum_values
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
    AND t.typname = 'NotificationType';

  IF enum_values IS DISTINCT FROM ARRAY[
    'LIKE','FOLLOW','WAKARU','GANBATTA','MODERATION'
  ]::TEXT[] THEN
    RAISE EXCEPTION 'Unexpected legacy NotificationType values: %', enum_values;
  END IF;

  SELECT count(*)
  INTO notification_type_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND udt_name = 'NotificationType';

  IF notification_type_columns <> 1 THEN
    RAISE EXCEPTION 'NotificationType is used by % columns, expected exactly 1', notification_type_columns;
  END IF;

  SELECT count(*)
  INTO active_legacy_migration_count
  FROM "_prisma_migrations"
  WHERE migration_name = '20260926073000_add_moderation_actions_and_appeals'
    AND finished_at IS NOT NULL
    AND rolled_back_at IS NULL;

  IF active_legacy_migration_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one active legacy moderation migration record, found %',
      active_legacy_migration_count;
  END IF;

  SELECT count(*)
  INTO restriction_migration_count
  FROM "_prisma_migrations"
  WHERE migration_name = '20260926103000_add_restriction_until'
    AND finished_at IS NOT NULL
    AND rolled_back_at IS NULL;

  IF restriction_migration_count <> 0 THEN
    RAISE EXCEPTION 'restrictionUntil migration is already recorded as applied';
  END IF;
END
$reconcile_guard$;

DROP TABLE "Appeal";
DROP TABLE "ModerationAction";
DROP TYPE "AppealStatus";
DROP TYPE "ModerationActionType";

ALTER TYPE "NotificationType" RENAME TO "NotificationType_legacy";
CREATE TYPE "NotificationType" AS ENUM ('LIKE', 'FOLLOW', 'WAKARU', 'GANBATTA');

ALTER TABLE "Notification"
ALTER COLUMN "type" TYPE "NotificationType"
USING ("type"::text::"NotificationType");

DROP TYPE "NotificationType_legacy";

DO $reconcile_history$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE "_prisma_migrations"
  SET rolled_back_at = CURRENT_TIMESTAMP
  WHERE migration_name = '20260926073000_add_moderation_actions_and_appeals'
    AND finished_at IS NOT NULL
    AND rolled_back_at IS NULL;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Expected to mark one legacy moderation migration rolled back, updated %',
      affected_rows;
  END IF;
END
$reconcile_history$;

COMMIT;
