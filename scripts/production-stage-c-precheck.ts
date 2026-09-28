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

async function tableExists(name: string) {
  const r = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
    ) AS present`,
    [name],
  );
  return Boolean(r.rows[0]?.present);
}

async function columnExists(table: string, column: string) {
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

async function count(table: string) {
  const r = await client.query(`SELECT count(*)::text AS count FROM "${table}"`);
  return Number(r.rows[0]?.count ?? 0);
}

async function main() {
  await client.connect();
  try {
    const failures: string[] = [];

    const followApprovalApplied = await migrationApplied('20260927002000_add_follow_approval');
    const destructiveApplied = await migrationApplied('20260928013000_remove_reply_and_quote_post');
    const restrictionApplied = await migrationApplied('20260926103000_add_restriction_until');
    const replyPresent = await tableExists('Reply');
    const quotePresent = await columnExists('Post', 'quotePostId');
    const moderationActionPresent = await tableExists('ModerationAction');
    const appealPresent = await tableExists('Appeal');
    const moderationWarningPresent = await tableExists('ModerationWarning');
    const warningAppealPresent = await tableExists('WarningAppeal');
    const sanctionPresent = await tableExists('Sanction');

    const replyRows = replyPresent ? await count('Reply') : null;
    const quotedPosts = quotePresent
      ? Number(
          (
            await client.query(
              `SELECT count(*)::text AS count FROM "Post" WHERE "quotePostId" IS NOT NULL`,
            )
          ).rows[0]?.count ?? 0,
        )
      : null;

    if (!followApprovalApplied) failures.push('Stage A boundary migration is not applied');
    if (!restrictionApplied) failures.push('restrictionUntil migration is not recorded applied');
    if (destructiveApplied) failures.push('Reply/Quote removal migration is already applied');
    if (!replyPresent) failures.push('Reply table must exist before Stage C');
    if (!quotePresent) failures.push('Post.quotePostId must exist before Stage C');
    if ((replyRows ?? 0) !== 0) failures.push(`Reply contains ${replyRows ?? 'unknown'} rows`);
    if ((quotedPosts ?? 0) !== 0) failures.push(`Quote data contains ${quotedPosts ?? 'unknown'} rows`);
    if (moderationActionPresent) failures.push('legacy ModerationAction must be absent after Stage A');
    if (appealPresent) failures.push('Appeal must be absent before Sanction Appeal migration');
    if (!moderationWarningPresent) failures.push('ModerationWarning must exist after Stage A');
    if (!warningAppealPresent) failures.push('WarningAppeal must exist after Stage A');
    if (sanctionPresent) failures.push('Sanction must remain absent before Stage C');

    const legacy = await client.query(
      `SELECT
         count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS active,
         count(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS rolled_back
       FROM "_prisma_migrations"
       WHERE migration_name = '20260926073000_add_moderation_actions_and_appeals'`,
    );
    const activeLegacy = Number(legacy.rows[0]?.active ?? 0);
    const rolledBackLegacy = Number(legacy.rows[0]?.rolled_back ?? 0);

    if (activeLegacy !== 0) failures.push('legacy moderation migration is still active');
    if (rolledBackLegacy < 1) failures.push('legacy moderation migration is not retained as rolled back');

    const report = {
      followApprovalApplied,
      restrictionApplied,
      destructiveApplied,
      replyPresent,
      quotePresent,
      replyRows,
      quotedPosts,
      moderationActionPresent,
      appealPresent,
      moderationWarningPresent,
      warningAppealPresent,
      sanctionPresent,
      activeLegacy,
      rolledBackLegacy,
      failures,
    };

    console.log('Production Stage C read-only precheck completed.');
    console.log(JSON.stringify(report, null, 2));

    if (failures.length) {
      throw new Error(`Production Stage C precheck failed: ${failures.join(' | ')}`);
    }

    console.log('Production Stage C read-only precheck passed.');
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
