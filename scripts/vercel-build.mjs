import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(args, env = process.env) {
  const result = spawnSync(npx, args, {
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function requireProductionEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required production environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function validateStaffMfaKey(value) {
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64');
  } catch {
    console.error('STAFF_MFA_ENCRYPTION_KEY must be valid base64.');
    process.exit(1);
  }

  if (decoded.length !== 32 || decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) {
    console.error('STAFF_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    process.exit(1);
  }
}

if (process.env.VERCEL_ENV === 'production') {
  requireProductionEnv('DATABASE_URL');
  if (!process.env.AUTH_SECRET?.trim() && !process.env.NEXTAUTH_SECRET?.trim()) {
    console.error('Missing required production authentication secret: AUTH_SECRET (or legacy NEXTAUTH_SECRET).');
    process.exit(1);
  }
  validateStaffMfaKey(requireProductionEnv('STAFF_MFA_ENCRYPTION_KEY'));
}

if (
  process.env.VERCEL_ENV === 'preview' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'preview'
) {
  const previewDatabaseUrl = process.env.PREVIEW_DATABASE_URL?.trim();
  if (!previewDatabaseUrl) {
    console.error('PREVIEW_DATABASE_URL is required for the approved one-shot Preview DB migration.');
    process.exit(1);
  }

  const migrationEnv = {
    ...process.env,
    DATABASE_URL: previewDatabaseUrl,
    PREVIEW_DATABASE_URL: previewDatabaseUrl,
    POSTGRES_URL_NON_POOLING: previewDatabaseUrl,
    POSTGRES_PRISMA_URL: previewDatabaseUrl,
    PREVIEW_MIGRATION_CONFIRM: 'MIGRATE_COCO_PREVIEW',
    PREVIEW_ALLOW_BASELINE: '0',
  };

  console.log('Running approved one-shot CoCo Preview DB migration.');
  run(['tsx', 'scripts/migrate-preview.ts'], migrationEnv);
}

run(['prisma', 'generate']);

run(['next', 'build']);
