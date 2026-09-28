import { Client } from 'pg';
import { normalizePostgresSslMode } from '../src/lib/databaseUrl';
import {
  validateProductionMigrationSafety,
} from '../src/lib/productionMigrationSafety';

const safety = validateProductionMigrationSafety({
  vercelEnv: process.env.VERCEL_ENV,
  gitRef: process.env.VERCEL_GIT_COMMIT_REF,
  databaseUrl: process.env.DATABASE_URL,
  productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL,
  expectedHost: process.env.PRODUCTION_DATABASE_HOST,
  expectedDatabaseName: process.env.PRODUCTION_DATABASE_NAME,
  confirmation: process.env.PRODUCTION_MIGRATION_CONFIRM,
});

if (!safety.ok) {
  console.error(safety.error);
  process.exit(1);
}

const approvedSafety = safety;
const connectionString = normalizePostgresSslMode(
  approvedSafety.productionDatabaseUrl,
);
const client = new Client({ connectionString });

const tableExists = async (table: string) => {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS present`,
    [table],
  );
  return Boolean(result.rows[0]?.present);
};

const columnExists = async (table: string, column: string) => {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS present`,
    [table, column],
  );
  return Boolean(result.rows[0]?.present);
};

const enumValues = async (enumName: string) => {
  const result = await client.query(
    `SELECT e.enumlabel AS value
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
       AND t.typname = $1
     ORDER BY e.enumsortorder ASC`,
    [enumName],
  );
  return result.rows.map((row) => String(row.value));
};

const rowCount = async (table: string) => {
  const result = await client.query(
    `SELECT count(*)::text AS count FROM "${table}"`,
  );
  return Number(result.rows[0]?.count ?? 0);
};

const sameValues = (actual: string[], expected: string[]) =>
  actual.length === expected.length &&
  actual.every((value, index) => value === expected[index]);

async function main() {
  try {
    await client.connect();

    const database = await client.query('SELECT current_database() AS name');
    if (database.rows[0]?.name !== approvedSafety.databaseName) {
      throw new Error(
        'Connected database name does not match the approved Production database.',
      );
    }

    if (approvedSafety.hostname.includes('-pooler.')) {
      throw new Error(
        'Production reconciliation requires the direct/unpooled Neon endpoint.',
      );
    }

    const failures: string[] = [];

    const moderationActionPresent = await tableExists('ModerationAction');
    const appealPresent = await tableExists('Appeal');
    const moderationWarningPresent = await tableExists('ModerationWarning');
    const warningAppealPresent = await tableExists('WarningAppeal');
    const sanctionPresent = await tableExists('Sanction');
    const restrictionUntilPresent = await columnExists(
      'User',
      'restrictionUntil',
    );
    const legacyAppealRelationPresent =
      appealPresent &&
      (await columnExists('Appeal', 'moderationActionId'));
    const currentAppealRelationPresent =
      appealPresent && (await columnExists('Appeal', 'sanctionId'));

    if (!moderationActionPresent) {
      failures.push('legacy ModerationAction table is missing');
    }
    if (!appealPresent) {
      failures.push('legacy Appeal table is missing');
    }
    if (!legacyAppealRelationPresent) {
      failures.push('Appeal.moderationActionId is missing');
    }
    if (currentAppealRelationPresent) {
      failures.push('Appeal.sanctionId is already present');
    }
    if (moderationWarningPresent || warningAppealPresent || sanctionPresent) {
      failures.push('current moderation schema is already partially present');
    }
    if (!restrictionUntilPresent) {
      failures.push('User.restrictionUntil is missing');
    }

    const moderationActionRows = moderationActionPresent
      ? await rowCount('ModerationAction')
      : null;
    const legacyAppealRows = appealPresent ? await rowCount('Appeal') : null;
    const replyRows = (await tableExists('Reply'))
      ? await rowCount('Reply')
      : null;

    const quotePostIdPresent = await columnExists('Post', 'quotePostId');
    const quotedPosts = quotePostIdPresent
      ? Number(
          (
            await client.query(
              `SELECT count(*)::text AS count
               FROM "Post"
               WHERE "quotePostId" IS NOT NULL`,
            )
          ).rows[0]?.count ?? 0,
        )
      : null;

    const notificationTypeValues = await enumValues('NotificationType');
    const moderationNotificationRows = notificationTypeValues.includes(
      'MODERATION',
    )
      ? Number(
          (
            await client.query(
              `SELECT count(*)::text AS count
               FROM "Notification"
               WHERE "type"::text = 'MODERATION'`,
            )
          ).rows[0]?.count ?? 0,
        )
      : null;

    const restrictionUntilUsers = restrictionUntilPresent
      ? Number(
          (
            await client.query(
              `SELECT count(*)::text AS count
               FROM "User"
               WHERE "restrictionUntil" IS NOT NULL`,
            )
          ).rows[0]?.count ?? 0,
        )
      : null;

    if ((moderationActionRows ?? 0) !== 0) {
      failures.push(
        `ModerationAction contains ${moderationActionRows ?? 'unknown'} rows`,
      );
    }
    if ((legacyAppealRows ?? 0) !== 0) {
      failures.push(
        `legacy Appeal contains ${legacyAppealRows ?? 'unknown'} rows`,
      );
    }
    if ((moderationNotificationRows ?? 0) !== 0) {
      failures.push(
        `MODERATION notifications contain ${moderationNotificationRows ?? 'unknown'} rows`,
      );
    }
    if ((restrictionUntilUsers ?? 0) !== 0) {
      failures.push(
        `restrictionUntil is active for ${restrictionUntilUsers ?? 'unknown'} users`,
      );
    }
    if ((replyRows ?? 0) !== 0) {
      failures.push(`Reply contains ${replyRows ?? 'unknown'} rows`);
    }
    if ((quotedPosts ?? 0) !== 0) {
      failures.push(`Quote data contains ${quotedPosts ?? 'unknown'} rows`);
    }

    const appealStatusValues = await enumValues('AppealStatus');
    if (
      !sameValues(appealStatusValues, [
        'OPEN',
        'REVIEWING',
        'UPHELD',
        'OVERTURNED',
      ])
    ) {
      failures.push(
        `unexpected legacy AppealStatus values: ${appealStatusValues.join(',')}`,
      );
    }

    const moderationActionTypeValues = await enumValues(
      'ModerationActionType',
    );
    if (
      !sameValues(moderationActionTypeValues, [
        'WARNING',
        'POST_HIDDEN',
        'POST_RESTORED',
        'POST_RESTRICTED',
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_RESTORED',
      ])
    ) {
      failures.push(
        `unexpected ModerationActionType values: ${moderationActionTypeValues.join(',')}`,
      );
    }

    if (
      !sameValues(notificationTypeValues, [
        'LIKE',
        'FOLLOW',
        'WAKARU',
        'GANBATTA',
        'MODERATION',
      ])
    ) {
      failures.push(
        `unexpected NotificationType values: ${notificationTypeValues.join(',')}`,
      );
    }

    const legacyMigration = await client.query(
      `SELECT count(*)::int AS count
       FROM "_prisma_migrations"
       WHERE migration_name = '20260926073000_add_moderation_actions_and_appeals'
         AND finished_at IS NOT NULL
         AND rolled_back_at IS NULL`,
    );
    const restrictionMigration = await client.query(
      `SELECT count(*)::int AS count
       FROM "_prisma_migrations"
       WHERE migration_name = '20260926103000_add_restriction_until'
         AND finished_at IS NOT NULL
         AND rolled_back_at IS NULL`,
    );

    const activeLegacyMigrationCount = Number(
      legacyMigration.rows[0]?.count ?? 0,
    );
    const appliedRestrictionMigrationCount = Number(
      restrictionMigration.rows[0]?.count ?? 0,
    );

    if (activeLegacyMigrationCount !== 1) {
      failures.push(
        `expected one active legacy moderation migration, found ${activeLegacyMigrationCount}`,
      );
    }
    if (appliedRestrictionMigrationCount !== 0) {
      failures.push(
        'restrictionUntil migration is already recorded as applied',
      );
    }

    const report = {
      hostname: approvedSafety.hostname,
      databaseName: approvedSafety.databaseName,
      moderationActionRows,
      legacyAppealRows,
      moderationNotificationRows,
      restrictionUntilUsers,
      replyRows,
      quotedPosts,
      appealStatusValues,
      moderationActionTypeValues,
      notificationTypeValues,
      activeLegacyMigrationCount,
      appliedRestrictionMigrationCount,
      failures,
    };

    console.log('Production reconciliation read-only precheck completed.');
    console.log(JSON.stringify(report, null, 2));

    if (failures.length) {
      throw new Error(
        `Production reconciliation precheck failed: ${failures.join(' | ')}`,
      );
    }

    console.log('Production reconciliation read-only precheck passed.');
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
