import { PREVIEW_GIT_REF } from './previewMigrationSafety';

export type PreviewSeedSafetyInput = {
  vercelEnv?: string;
  gitRef?: string;
  seedUsers?: string;
  databaseUrl?: string;
  previewDatabaseUrl?: string;
  testPassword?: string;
  e2eMode?: string;
};

export type PreviewSeedSafetyResult =
  | { ok: true; databaseUrl: string; previewDatabaseUrl: string; testPassword: string }
  | { ok: false; error: string };

function normalized(value?: string) {
  return value?.trim() ?? '';
}

function isLoopbackPostgresUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') return false;
    return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function validatePreviewSeedSafety(
  input: PreviewSeedSafetyInput,
): PreviewSeedSafetyResult {
  if (normalized(input.vercelEnv) !== 'preview') {
    return { ok: false, error: 'Preview test users can only be seeded when VERCEL_ENV=preview.' };
  }
  const databaseUrl = normalized(input.databaseUrl);
  const previewDatabaseUrl = normalized(input.previewDatabaseUrl);
  const isolatedE2E =
    normalized(input.e2eMode) === '1' &&
    databaseUrl === previewDatabaseUrl &&
    isLoopbackPostgresUrl(previewDatabaseUrl);

  if (normalized(input.gitRef) !== PREVIEW_GIT_REF && !isolatedE2E) {
    return {
      ok: false,
      error: `Preview test users can only be seeded on ${PREVIEW_GIT_REF}, except for isolated loopback E2E databases.`,
    };
  }
  if (normalized(input.seedUsers) !== '1') {
    return { ok: false, error: 'PREVIEW_SEED_USERS=1 is required to seed preview test users.' };
  }

  if (!databaseUrl) {
    return { ok: false, error: 'DATABASE_URL is required for Preview seeding.' };
  }
  if (!previewDatabaseUrl) {
    return { ok: false, error: 'PREVIEW_DATABASE_URL is required.' };
  }
  if (databaseUrl !== previewDatabaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL must exactly match PREVIEW_DATABASE_URL before Preview seeding.',
    };
  }

  const testPassword = input.testPassword ?? '';
  if (testPassword.length < 10 || testPassword.length > 128) {
    return { ok: false, error: 'PREVIEW_TEST_PASSWORD must be 10-128 characters.' };
  }

  return { ok: true, databaseUrl, previewDatabaseUrl, testPassword };
}
