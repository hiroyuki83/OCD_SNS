import { spawnSync } from 'node:child_process';
import { Client } from 'pg';
import {
  PREVIEW_MIGRATION_CONFIRMATION,
  validatePreviewMigrationSafety,
} from '../src/lib/previewMigrationSafety';

import { PREVIEW_HISTORICAL_MIGRATIONS } from '../src/lib/previewMigrationPlan';

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

function runCommand(args: string[]) {
  const result = spawnSync(npx, args, {
    stdio: 'inherit',
    env: forcedEnv,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runPrisma(args: string[]) {
  runCommand(['prisma', ...args]);
}

console.log('Running Preview DB safety preflight.');
runCommand(['tsx', 'scripts/preview-db-preflight.ts']);

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
    for (const migration of PREVIEW_HISTORICAL_MIGRATIONS) {
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
    const missingHistorical = PREVIEW_HISTORICAL_MIGRATIONS.filter((name) => !applied.has(name));
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

  console.log('Verifying Preview schema after migration.');
  runCommand(['tsx', 'scripts/preview-db-verify.ts']);
} finally {
  if (!clientClosed) await client.end().catch(() => undefined);
}
