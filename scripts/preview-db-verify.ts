import { Client } from 'pg';
import {
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

import { PREVIEW_PENDING_MIGRATIONS } from '../src/lib/previewMigrationPlan';

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
    ['Post.imageAlt present', await columnExists('Post', 'imageAlt')],
    ['User.notifyLikes present', await columnExists('User', 'notifyLikes')],
    ['User.notifyReactions present', await columnExists('User', 'notifyReactions')],
    ['User.notifyFollows present', await columnExists('User', 'notifyFollows')],
    ['EmailVerificationToken.pendingEmail present', await columnExists('EmailVerificationToken', 'pendingEmail')],
    ['Sanction table added', await tableExists('Sanction')],
    ['Sanction.type added', await columnExists('Sanction', 'type')],
    ['Sanction.status added', await columnExists('Sanction', 'status')],
    ['Sanction.reason added', await columnExists('Sanction', 'reason')],
    ['Sanction.targetUserId added', await columnExists('Sanction', 'targetUserId')],
    ['Sanction.actorUserId added', await columnExists('Sanction', 'actorUserId')],
    ['Sanction.reportId added', await columnExists('Sanction', 'reportId')],
    ['Sanction.endsAt added', await columnExists('Sanction', 'endsAt')],
    ['Sanction.revokedAt added', await columnExists('Sanction', 'revokedAt')],
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
    [PREVIEW_PENDING_MIGRATIONS],
  );

  const applied = new Set(
    migrationRows.rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => row.migration_name),
  );
  const missingMigrations = PREVIEW_PENDING_MIGRATIONS.filter((name) => !applied.has(name));
  if (missingMigrations.length) {
    throw new Error(`Expected Preview migrations are not recorded as applied: ${missingMigrations.join(', ')}`);
  }

  console.log('Preview schema verification passed.');
  for (const [name] of checks) console.log(`OK ${name}`);
} finally {
  await client.end().catch(() => undefined);
}
