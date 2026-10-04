import { Client } from 'pg';
import {
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';
import {
  PREVIEW_EXPECTED_MIGRATIONS,
  PREVIEW_HISTORICAL_MIGRATIONS,
} from '../src/lib/previewMigrationPlan';

async function main() {
  const safety = validatePreviewMigrationSafety({
    vercelEnv: process.env.VERCEL_ENV,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF,
    databaseUrl: process.env.DATABASE_URL,
    previewDatabaseUrl: process.env.PREVIEW_DATABASE_URL,
    confirmation: process.env.PREVIEW_MIGRATION_CONFIRM,
  });

  if (!safety.ok) {
    console.error(safety.error);
    process.exit(1);
  }

  const client = new Client({ connectionString: safety.previewDatabaseUrl });

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

  try {
    await client.connect();

    const database = await client.query('SELECT current_database() AS name');
    if (database.rows[0]?.name !== safety.databaseName) {
      throw new Error('Connected database name does not match the approved Preview database.');
    }

    const migrationTable = await client.query(
      `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
    );
    if (!migrationTable.rows[0]?.present) {
      throw new Error(
        'Preview DB has no Prisma migration history. Automatic baselining is disabled; manual reconciliation is required.',
      );
    }

    const migrationRows = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"`,
    );
    const applied = new Set(
      migrationRows.rows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => String(row.migration_name)),
    );

    const missingHistorical = PREVIEW_HISTORICAL_MIGRATIONS.filter(
      (name) => !applied.has(name),
    );
    if (missingHistorical.length) {
      throw new Error(
        `Preview migration history is missing accepted historical migrations: ${missingHistorical.join(', ')}`,
      );
    }

    const expected = new Set<string>(PREVIEW_EXPECTED_MIGRATIONS);
    const unknownApplied = [...applied].filter((name) => !expected.has(name)).sort();
    if (unknownApplied.length) {
      throw new Error(
        `Preview DB contains applied migrations not present in the repository migration plan: ${unknownApplied.join(', ')}`,
      );
    }

    const signatures = [
      ['User table present', await tableExists('User')],
      ['Post table present', await tableExists('Post')],
      ['WarningAppeal table present', await tableExists('WarningAppeal')],
      ['StaffRecoveryCode table present', await tableExists('StaffRecoveryCode')],
      ['Sanction table present', await tableExists('Sanction')],
      ['Appeal table present', await tableExists('Appeal')],
      ['Reply table removed', !(await tableExists('Reply'))],
      ['User.handle present', await columnExists('User', 'handle')],
      ['User.sessionVersion present', await columnExists('User', 'sessionVersion')],
      ['Post.quotePostId removed', !(await columnExists('Post', 'quotePostId'))],
      ['Post.imageAlt present', await columnExists('Post', 'imageAlt')],
      ['User.notifyLikes present', await columnExists('User', 'notifyLikes')],
      ['User.notifyReactions present', await columnExists('User', 'notifyReactions')],
      ['User.notifyFollows present', await columnExists('User', 'notifyFollows')],
      [
        'EmailVerificationToken.pendingEmail present',
        await columnExists('EmailVerificationToken', 'pendingEmail'),
      ],
    ] as const;

    const drift = signatures.filter(([, ok]) => !ok).map(([name]) => name);
    if (drift.length) {
      throw new Error(
        `Preview DB baseline schema drift detected; manual reconciliation required: ${drift.join(', ')}`,
      );
    }

    console.log('Preview DB read-only preflight passed.');
    console.log({
      database: safety.databaseName,
      hostname: safety.hostname,
      acceptedHistoricalMigrations: PREVIEW_HISTORICAL_MIGRATIONS.length,
      repositoryExpectedMigrations: PREVIEW_EXPECTED_MIGRATIONS.length,
      appliedMigrations: applied.size,
    });
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
