import { Client } from 'pg';
import {
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';
import {
  PREVIEW_EXPECTED_MIGRATIONS,
} from '../src/lib/previewMigrationPlan';

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
    ['User table present', await tableExists('User')],
    ['Post table present', await tableExists('Post')],
    ['Reply table removed', !(await tableExists('Reply'))],
    ['Post.quotePostId removed', !(await columnExists('Post', 'quotePostId'))],
    ['Post.imageAlt present', await columnExists('Post', 'imageAlt')],
    ['User.notifyLikes present', await columnExists('User', 'notifyLikes')],
    ['User.notifyReactions present', await columnExists('User', 'notifyReactions')],
    ['User.notifyFollows present', await columnExists('User', 'notifyFollows')],
    [
      'EmailVerificationToken.pendingEmail present',
      await columnExists('EmailVerificationToken', 'pendingEmail'),
    ],
    ['Sanction table present', await tableExists('Sanction')],
    ['Sanction.type present', await columnExists('Sanction', 'type')],
    ['Sanction.status present', await columnExists('Sanction', 'status')],
    ['Sanction.reason present', await columnExists('Sanction', 'reason')],
    ['Sanction.targetUserId present', await columnExists('Sanction', 'targetUserId')],
    ['Sanction.actorUserId present', await columnExists('Sanction', 'actorUserId')],
    ['Appeal table present', await tableExists('Appeal')],
    ['Appeal.message present', await columnExists('Appeal', 'message')],
    ['Appeal.status present', await columnExists('Appeal', 'status')],
    ['Appeal.resolutionNote present', await columnExists('Appeal', 'resolutionNote')],
    ['Appeal.reviewedAt present', await columnExists('Appeal', 'reviewedAt')],
    ['Appeal.reviewerId present', await columnExists('Appeal', 'reviewerId')],
    ['Appeal.sanctionId present', await columnExists('Appeal', 'sanctionId')],
    ['Appeal.userId present', await columnExists('Appeal', 'userId')],
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
     FROM "_prisma_migrations"`,
  );
  const applied = new Set(
    migrationRows.rows
      .filter((row) => row.finished_at && !row.rolled_back_at)
      .map((row) => String(row.migration_name)),
  );

  const missingMigrations = PREVIEW_EXPECTED_MIGRATIONS.filter(
    (name) => !applied.has(name),
  );
  if (missingMigrations.length) {
    throw new Error(
      `Repository Preview migrations are not recorded as applied: ${missingMigrations.join(', ')}`,
    );
  }

  const expected = new Set<string>(PREVIEW_EXPECTED_MIGRATIONS);
  const unknownApplied = [...applied].filter((name) => !expected.has(name)).sort();
  if (unknownApplied.length) {
    throw new Error(
      `Preview DB contains applied migrations not present in the repository migration plan: ${unknownApplied.join(', ')}`,
    );
  }

  console.log('Preview schema verification passed.');
  console.log({
    appliedMigrations: applied.size,
    expectedMigrations: PREVIEW_EXPECTED_MIGRATIONS.length,
  });
  for (const [name] of checks) console.log(`OK ${name}`);
} finally {
  await client.end().catch(() => undefined);
}
