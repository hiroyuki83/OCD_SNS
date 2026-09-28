import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
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

const migrationDir = resolve(process.cwd(), 'prisma', 'migrations');
const localMigrations = readdirSync(migrationDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

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

const tableColumns = async (table: string) => {
  if (!(await tableExists(table))) return [];
  const result = await client.query(
    `SELECT column_name AS "columnName",
            data_type AS "dataType",
            udt_name AS "udtName",
            is_nullable AS "isNullable",
            column_default AS "columnDefault"
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position ASC`,
    [table],
  );
  return result.rows;
};

const tableConstraints = async (table: string) => {
  if (!(await tableExists(table))) return [];
  const result = await client.query(
    `SELECT con.conname AS "name",
            con.contype AS "type",
            pg_get_constraintdef(con.oid, true) AS "definition"
     FROM pg_constraint con
     JOIN pg_class rel ON rel.oid = con.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = $1
     ORDER BY con.conname ASC`,
    [table],
  );
  return result.rows;
};

const enumValues = async (enumName: string) => {
  const result = await client.query(
    `SELECT e.enumlabel AS "value"
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

const optionalRowCount = async (table: string) => {
  if (!(await tableExists(table))) return null;
  const result = await client.query(
    `SELECT count(*)::text AS count FROM "${table}"`,
  );
  return Number(result.rows[0]?.count ?? 0);
};

// Keep the entrypoint compatible with tsx's CommonJS execution mode.
async function main() {
  try {
    await client.connect();

    const database = await client.query('SELECT current_database() AS name');
    if (database.rows[0]?.name !== approvedSafety.databaseName) {
      throw new Error(
        'Connected database name does not match the approved Production database.',
      );
    }

    const historyTable = await client.query(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
    );
    if (!historyTable.rows[0]?.present) {
      throw new Error(
        'Production DB has no Prisma migration history. Refusing to infer or baseline automatically.',
      );
    }

    const migrationRows = await client.query(
      `SELECT migration_name,
              started_at,
              finished_at,
              rolled_back_at,
              applied_steps_count
       FROM "_prisma_migrations"
       ORDER BY started_at ASC`,
    );

    const applied = new Set(
      migrationRows.rows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => String(row.migration_name)),
    );

    const migrationHistoryIssues = migrationRows.rows
      .filter((row) => !row.finished_at || row.rolled_back_at)
      .map((row) => ({
        migrationName: String(row.migration_name),
        state: row.rolled_back_at ? 'ROLLED_BACK' : 'UNFINISHED',
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        rolledBackAt: row.rolled_back_at,
        appliedStepsCount: Number(row.applied_steps_count ?? 0),
      }));

    const pending = localMigrations.filter((name) => !applied.has(name));
    const unknown = [...applied]
      .filter((name) => !localMigrations.includes(name))
      .sort();

    const moderationWarningTable = await tableExists('ModerationWarning');
    const warningAppealTable = await tableExists('WarningAppeal');
    const appealTable = await tableExists('Appeal');
    const sanctionTable = await tableExists('Sanction');

    const pendingObjectCollisions: string[] = [];

    if (
      pending.includes('20260926100000_add_moderation_warning') &&
      moderationWarningTable
    ) {
      pendingObjectCollisions.push(
        'ModerationWarning table already exists before its pending migration',
      );
    }

    if (
      pending.includes('20260926101500_add_warning_read_state') &&
      moderationWarningTable &&
      (await columnExists('ModerationWarning', 'readAt'))
    ) {
      pendingObjectCollisions.push(
        'ModerationWarning.readAt already exists before its pending migration',
      );
    }

    if (
      pending.includes('20260926104500_add_warning_appeal') &&
      warningAppealTable
    ) {
      pendingObjectCollisions.push(
        'WarningAppeal table already exists before its pending migration',
      );
    }

    if (
      pending.includes('20260926111500_add_appeal_review') &&
      ((warningAppealTable && await columnExists('WarningAppeal', 'status')) ||
        (moderationWarningTable &&
          await columnExists('ModerationWarning', 'revokedAt')))
    ) {
      pendingObjectCollisions.push(
        'warning appeal review schema already exists before its pending migration',
      );
    }

    if (
      pending.includes('20260928071000_add_sanction_records') &&
      sanctionTable
    ) {
      pendingObjectCollisions.push(
        'Sanction table already exists before its pending migration',
      );
    }

    if (
      pending.includes('20260928110500_add_sanction_appeals') &&
      appealTable
    ) {
      pendingObjectCollisions.push(
        'Appeal table already exists before the pending Sanction Appeal migration',
      );
    }

    const blockers: string[] = [];

    if (migrationHistoryIssues.length) {
      blockers.push(
        `migration history issues: ${migrationHistoryIssues
          .map((item) => `${item.migrationName}(${item.state})`)
          .join(', ')}`,
      );
    }

    if (unknown.length) {
      blockers.push(
        `applied migrations not present on main: ${unknown.join(', ')}`,
      );
    }

    if (pendingObjectCollisions.length) {
      blockers.push(
        `pending migration object collisions: ${pendingObjectCollisions.join('; ')}`,
      );
    }

    const drift: string[] = [];

    if (
      applied.has('20260926123000_add_staff_totp') &&
      !(await columnExists('User', 'staffTotpSecretEncrypted'))
    ) {
      drift.push(
        'User.staffTotpSecretEncrypted missing despite staff TOTP migration',
      );
    }

    if (
      applied.has('20260928013000_remove_reply_and_quote_post') &&
      (await tableExists('Reply'))
    ) {
      drift.push('Reply table present despite reply-removal migration');
    }

    if (
      applied.has('20260928013000_remove_reply_and_quote_post') &&
      (await columnExists('Post', 'quotePostId'))
    ) {
      drift.push('Post.quotePostId present despite quote-removal migration');
    }

    if (
      applied.has('20260928071000_add_sanction_records') &&
      !(await tableExists('Sanction'))
    ) {
      drift.push('Sanction table missing despite sanction migration');
    }

    if (
      applied.has('20260928110500_add_sanction_appeals') &&
      !(await tableExists('Appeal'))
    ) {
      drift.push('Appeal table missing despite appeal migration');
    }

    if (drift.length) {
      blockers.push(
        `schema does not match recorded migration history: ${drift.join('; ')}`,
      );
    }

    const userRows = Number(
      (await client.query(`SELECT count(*)::text AS count FROM "User"`)).rows[0]
        ?.count ?? 0,
    );
    const postRows = Number(
      (await client.query(`SELECT count(*)::text AS count FROM "Post"`)).rows[0]
        ?.count ?? 0,
    );
    const followRows = (await tableExists('Follow'))
      ? Number(
          (await client.query(`SELECT count(*)::text AS count FROM "Follow"`))
            .rows[0]?.count ?? 0,
        )
      : null;
    const replyRows = (await tableExists('Reply'))
      ? Number(
          (await client.query(`SELECT count(*)::text AS count FROM "Reply"`))
            .rows[0]?.count ?? 0,
        )
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

    const destructiveRemovalBlocked =
      (replyRows ?? 0) > 0 || (quotedPosts ?? 0) > 0;

    const moderationConflictDiagnostics = {
      ModerationWarning: {
        present: moderationWarningTable,
        rowCount: await optionalRowCount('ModerationWarning'),
        columns: await tableColumns('ModerationWarning'),
        constraints: await tableConstraints('ModerationWarning'),
      },
      WarningAppeal: {
        present: warningAppealTable,
        rowCount: await optionalRowCount('WarningAppeal'),
        columns: await tableColumns('WarningAppeal'),
        constraints: await tableConstraints('WarningAppeal'),
      },
      Appeal: {
        present: appealTable,
        rowCount: await optionalRowCount('Appeal'),
        columns: await tableColumns('Appeal'),
        constraints: await tableConstraints('Appeal'),
      },
      enums: {
        WarningAppealStatus: await enumValues('WarningAppealStatus'),
        AppealStatus: await enumValues('AppealStatus'),
      },
    };

    if (destructiveRemovalBlocked) {
      blockers.push(
        'Production contains Reply or Quote data; automatic reply/quote removal is blocked pending an explicit data-handling decision',
      );
    }

    const report = {
      hostname: approvedSafety.hostname,
      databaseName: approvedSafety.databaseName,
      localMigrationCount: localMigrations.length,
      migrationHistoryRowCount: migrationRows.rows.length,
      appliedMigrationCount: applied.size,
      pendingMigrations: pending,
      migrationHistoryIssues,
      unknownAppliedMigrations: unknown,
      pendingObjectCollisions,
      moderationConflictDiagnostics,
      productionRowCounts: {
        userRows,
        postRows,
        followRows,
        replyRows,
        quotedPosts,
      },
      productionSchemaSignatures: {
        staffTotpSecretEncrypted:
          await columnExists('User', 'staffTotpSecretEncrypted'),
        replyTable: await tableExists('Reply'),
        quotePostId: quotePostIdPresent,
        sanctionTable,
        appealTable,
      },
      destructiveRemovalBlocked,
      blockers,
    };

    console.log('Production DB read-only preflight completed.');
    console.log(report);

    if (blockers.length) {
      throw new Error(`Production preflight blockers: ${blockers.join(' | ')}`);
    }

    console.log('Production DB read-only preflight passed.');
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
