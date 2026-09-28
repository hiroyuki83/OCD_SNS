import { Client } from 'pg';
import { normalizePostgresSslMode } from '../src/lib/databaseUrl';
import { validateProductionMigrationSafety } from '../src/lib/productionMigrationSafety';

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

const client = new Client({
  connectionString: normalizePostgresSslMode(safety.productionDatabaseUrl),
});

async function existsTable(name: string) {
  const r = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS present`,
    [name],
  );
  return Boolean(r.rows[0]?.present);
}

async function existsColumn(table: string, column: string) {
  const r = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    ) AS present`,
    [table, column],
  );
  return Boolean(r.rows[0]?.present);
}

async function migrationApplied(name: string) {
  const r = await client.query(
    `SELECT count(*)::int AS count
     FROM "_prisma_migrations"
     WHERE migration_name = $1
       AND finished_at IS NOT NULL
       AND rolled_back_at IS NULL`,
    [name],
  );
  return Number(r.rows[0]?.count ?? 0) === 1;
}

async function main() {
  await client.connect();
  try {
    const failures: string[] = [];

    if (!(await migrationApplied('20260927002000_add_follow_approval'))) {
      failures.push('Stage A boundary migration add_follow_approval is not applied');
    }
    if (await migrationApplied('20260928013000_remove_reply_and_quote_post')) {
      failures.push('Destructive Reply/Quote removal migration must remain pending after Stage A');
    }
    if (!(await existsTable('Reply'))) {
      failures.push('Reply table must still exist after Stage A');
    }
    if (!(await existsColumn('Post', 'quotePostId'))) {
      failures.push('Post.quotePostId must still exist after Stage A');
    }
    if (!(await existsTable('ModerationWarning'))) {
      failures.push('ModerationWarning must exist after Stage A');
    }
    if (!(await existsTable('WarningAppeal'))) {
      failures.push('WarningAppeal must exist after Stage A');
    }
    if (!(await existsColumn('User', 'staffTotpSecretEncrypted'))) {
      failures.push('staff TOTP schema must exist after Stage A');
    }
    if (!(await existsColumn('Follow', 'acceptedAt'))) {
      failures.push('Follow.acceptedAt must exist after Stage A');
    }
    if (await existsTable('Sanction')) {
      failures.push('Sanction must remain absent until after the destructive boundary');
    }

    console.log(JSON.stringify({ stage: 'A', failures }, null, 2));
    if (failures.length) throw new Error(failures.join(' | '));
    console.log('Production Stage A schema verification passed.');
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
