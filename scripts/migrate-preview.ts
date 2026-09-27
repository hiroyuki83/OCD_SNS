import { spawnSync } from 'node:child_process';
// @ts-expect-error -- pg does not ship project-local TypeScript declarations here.
import { Client } from 'pg';
import {
  PREVIEW_MIGRATION_CONFIRMATION,
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

const HISTORICAL_MIGRATIONS = [
  '20260126012737_init',
  '20260126014230_add_posts_and_likes',
  '20260126022628_add_notifications',
  '20260126041237_add_ybocs',
  '20260126043946_add_cgi_fields',
  '20260126060401_add_bookmarks',
  '20260126064122_add_profile_fields',
  '20260126101000_add_replies',
  '20260126103000_add_reaction_counts',
  '20260126112000_add_reactions',
  '20260126150000_add_quote_post',
  '20260129090000_add_block_mute',
  '20260129102000_add_private_account',
  '20260129112000_add_reaction_notifications',
  '20260129160000_add_iesr',
  '20260129170000_add_itq',
  '20260129173000_add_lsas',
  '20260129180000_add_auto_hashtag',
  '20260129190000_add_rbac',
  '20260706073000_add_reports_and_moderation',
  '20260706113000_add_announcements',
  '20260706142000_add_ops_admin_tools',
  '20260706152000_add_password_reset_tokens',
  '20260707011000_add_post_soft_delete',
  '20260720090000_add_email_verification_and_rate_limits',
  '20260926060000_add_public_handle',
  '20260926100000_add_moderation_warning',
  '20260926101500_add_warning_read_state',
  '20260926103000_add_restriction_until',
  '20260926104500_add_warning_appeal',
  '20260926111500_add_appeal_review',
  '20260926120000_add_session_version',
  '20260926123000_add_staff_totp',
  '20260926124500_add_staff_recovery_codes',
  '20260927002000_add_follow_approval',
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

if (process.env.PREVIEW_MIGRATION_CONFIRM?.trim() !== PREVIEW_MIGRATION_CONFIRMATION) {
  console.error('Explicit Preview migration confirmation is missing.');
  process.exit(1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const forcedEnv = {
  ...process.env,
  DATABASE_URL: safety.previewDatabaseUrl,
  PREVIEW_DATABASE_URL: safety.previewDatabaseUrl,
  POSTGRES_URL_NON_POOLING: safety.previewDatabaseUrl,
  POSTGRES_PRISMA_URL: safety.previewDatabaseUrl,
  VERCEL_ENV: 'preview',
};

function runPrisma(args: string[]) {
  const result = spawnSync(npx, ['prisma', ...args], {
    stdio: 'inherit',
    env: forcedEnv,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const client = new Client({ connectionString: safety.previewDatabaseUrl });
let clientClosed = false;
await client.connect();

try {
  const history = await client.query(
    `SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`,
  );

  if (!history.rows[0]?.present) {
    if (process.env.PREVIEW_ALLOW_BASELINE !== '1') {
      console.error(
        'Preview DB has no Prisma migration history. PREVIEW_ALLOW_BASELINE=1 is required to baseline the verified historical schema.',
      );
      process.exit(1);
    }

    await client.end();
    clientClosed = true;

    console.log('Baselining historical Preview migrations without re-running their SQL.');
    for (const migration of HISTORICAL_MIGRATIONS) {
      runPrisma(['migrate', 'resolve', '--applied', migration]);
    }
  } else {
    const rows = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at
       FROM "_prisma_migrations"`,
    );
    const applied = new Set(
      rows.rows
        .filter((row) => row.finished_at && !row.rolled_back_at)
        .map((row) => row.migration_name),
    );
    const missingHistorical = HISTORICAL_MIGRATIONS.filter((name) => !applied.has(name));
    if (missingHistorical.length) {
      console.error(
        `Existing migration history is incomplete; refusing to auto-baseline: ${missingHistorical.join(', ')}`,
      );
      process.exit(1);
    }
    await client.end();
    clientClosed = true;
  }

  console.log('Applying pending migrations to approved Preview DB only.');
  runPrisma(['migrate', 'deploy']);
} finally {
  if (!clientClosed) await client.end().catch(() => undefined);
}
