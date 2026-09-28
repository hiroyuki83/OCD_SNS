import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
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

const client = new Client({ connectionString: approvedSafety.productionDatabaseUrl });

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
    `SELECT migration_name, finished_at, rolled_back_at
     FROM "_prisma_migrations"
     ORDER BY started_at ASC`,
  );

  const applied = new Set(
    migrationRows.rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => String(row.migration_name)),
  );

  const incomplete = migrationRows.rows
    .filter((row) => !row.finished_at || row.rolled_back_at)
    .map((row) => String(row.migration_name));

  const pending = localMigrations.filter((name) => !applied.has(name));
  const unknown = [...applied].filter((name) => !localMigrations.includes(name));

  if (incomplete.length) {
    throw new Error(
      `Production migration history contains incomplete or rolled-back entries: ${incomplete.join(', ')}`,
    );
  }

  if (unknown.length) {
    throw new Error(
      `Production migration history contains migrations not present on main: ${unknown.join(', ')}`,
    );
  }

  const drift: string[] = [];

  if (
    applied.has('20260926123000_add_staff_totp') &&
    !(await columnExists('User', 'staffTotpSecretEncrypted'))
  ) {
    drift.push('User.staffTotpSecretEncrypted missing despite staff TOTP migration');
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
    throw new Error(
      `Production schema does not match recorded migration history: ${drift.join('; ')}`,
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

  const report = {
    hostname: approvedSafety.hostname,
    databaseName: approvedSafety.databaseName,
    localMigrationCount: localMigrations.length,
    appliedMigrationCount: applied.size,
    pendingMigrations: pending,
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
      sanctionTable: await tableExists('Sanction'),
      appealTable: await tableExists('Appeal'),
    },
    destructiveRemovalBlocked,
  };

  console.log('Production DB read-only preflight passed.');
  console.log(report);

  if (destructiveRemovalBlocked) {
    throw new Error(
      'Production contains Reply or Quote data. Automatic reply/quote removal migration is blocked pending an explicit data-handling decision.',
    );
  }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
