export const PREVIEW_GIT_REF = 'feature/sanction-appeals-20260928';
export const PREVIEW_DATABASE_NAME = 'neondb';
export const PREVIEW_DATABASE_HOSTS = new Set([
  'ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech',
  'ep-aged-darkness-b3se3dw1-pooler.c-4.ap-southeast-1.aws.neon.tech',
]);

export const PREVIEW_MIGRATION_CONFIRMATION = 'MIGRATE_COCO_PREVIEW';

export type PreviewMigrationSafetyInput = {
  vercelEnv?: string;
  gitRef?: string;
  databaseUrl?: string;
  previewDatabaseUrl?: string;
  confirmation?: string;
};

export type PreviewMigrationSafetyResult =
  | {
      ok: true;
      previewDatabaseUrl: string;
      hostname: string;
      databaseName: string;
    }
  | { ok: false; error: string };

function normalized(value?: string) {
  return value?.trim() ?? '';
}

function parsePostgresUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function validatePreviewMigrationSafety(
  input: PreviewMigrationSafetyInput,
): PreviewMigrationSafetyResult {
  if (normalized(input.vercelEnv) !== 'preview') {
    return { ok: false, error: 'Preview migration requires VERCEL_ENV=preview.' };
  }

  if (normalized(input.gitRef) !== PREVIEW_GIT_REF) {
    return {
      ok: false,
      error: `Preview migration is restricted to ${PREVIEW_GIT_REF}.`,
    };
  }

  if (normalized(input.confirmation) !== PREVIEW_MIGRATION_CONFIRMATION) {
    return {
      ok: false,
      error: `Preview migration requires confirmation ${PREVIEW_MIGRATION_CONFIRMATION}.`,
    };
  }

  const databaseUrl = normalized(input.databaseUrl);
  const previewDatabaseUrl = normalized(input.previewDatabaseUrl);

  if (!databaseUrl || !previewDatabaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL and PREVIEW_DATABASE_URL are both required.',
    };
  }

  if (databaseUrl !== previewDatabaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL must exactly match PREVIEW_DATABASE_URL.',
    };
  }

  const url = parsePostgresUrl(previewDatabaseUrl);
  if (!url) {
    return { ok: false, error: 'PREVIEW_DATABASE_URL must be a PostgreSQL URL.' };
  }

  if (!PREVIEW_DATABASE_HOSTS.has(url.hostname)) {
    return {
      ok: false,
      error: 'PREVIEW_DATABASE_URL does not point to the approved coco-preview endpoint.',
    };
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (databaseName !== PREVIEW_DATABASE_NAME) {
    return {
      ok: false,
      error: `Preview migration requires database ${PREVIEW_DATABASE_NAME}.`,
    };
  }

  return {
    ok: true,
    previewDatabaseUrl,
    hostname: url.hostname,
    databaseName,
  };
}
