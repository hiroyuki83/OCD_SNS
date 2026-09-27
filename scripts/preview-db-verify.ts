// @ts-expect-error -- pg does not ship project-local TypeScript declarations here.
import { Client } from 'pg';
import {
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

const EXPECTED_MIGRATIONS = [
  '20260928013000_remove_reply_and_quote_post',
  '20260928014500_add_post_image_alt',
  '20260928023000_add_notification_preferences',
  '20260928031500_add_email_change_pending',
] as const;

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

  const checks = [
    ['Reply table removed', !(await tableExists('Reply'))],
    ['Post.quotePostId removed', !(await columnExists('Post', 'quotePostId'))],
    ['Post.imageAlt added', await columnExists('Post', 'imageAlt')],
    ['User.notifyLikes added', await columnExists('User', 'notifyLikes')],
    ['User.notifyReactions added', await columnExists('User', 'notifyReactions')],
    ['User.notifyFollows added', await columnExists('User', 'notifyFollows')],
    ['EmailVerificationToken.pendingEmail added', await columnExists('EmailVerificationToken', 'pendingEmail')],
  ] as const;

  const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failures.length) {
    throw new Error(`Preview schema verification failed: ${failures.join(', ')}`);
  }

  const migrationTable = await client.query(
    `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
  );
  if (!migrationTable.rows[0]?.present) {
    throw new Error('Prisma migration history table is missing after migration.');
  }

  const migrationRows = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at
     FROM "_prisma_migrations"
     WHERE migration_name = ANY($1::text[])`,
    [EXPECTED_MIGRATIONS],
  );

  const applied = new Set(
    migrationRows.rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name),
  );
  const missingMigrations = EXPECTED_MIGRATIONS.filter((name) => !applied.has(name));
  if (missingMigrations.length) {
    throw new Error(`Expected Preview migrations are not recorded as applied: ${missingMigrations.join(', ')}`);
  }

  console.log('Preview schema verification passed.');
  for (const [name] of checks) console.log(`OK ${name}`);
} finally {
  await client.end().catch(() => undefined);
}
