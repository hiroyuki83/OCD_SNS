export const PRODUCTION_GIT_REF = 'main';
export const PRODUCTION_MIGRATION_CONFIRMATION = 'CHECK_COCO_PRODUCTION';

export const PREVIEW_DATABASE_HOSTS = new Set([
  'ep-aged-darkness-b3se3dw1.c-4.ap-southeast-1.aws.neon.tech',
  'ep-aged-darkness-b3se3dw1-pooler.c-4.ap-southeast-1.aws.neon.tech',
]);

export type ProductionMigrationSafetyInput = {
  vercelEnv?: string;
  gitRef?: string;
  databaseUrl?: string;
  productionDatabaseUrl?: string;
  expectedHost?: string;
  expectedDatabaseName?: string;
  confirmation?: string;
};

export type ProductionMigrationSafetyResult =
  | {
      ok: true;
      productionDatabaseUrl: string;
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

export function validateProductionMigrationSafety(
  input: ProductionMigrationSafetyInput,
): ProductionMigrationSafetyResult {
  if (normalized(input.vercelEnv) !== 'production') {
    return {
      ok: false,
      error: 'Production preflight requires VERCEL_ENV=production.',
    };
  }

  if (normalized(input.gitRef) !== PRODUCTION_GIT_REF) {
    return {
      ok: false,
      error: 'Production preflight is restricted to main.',
    };
  }

  if (normalized(input.confirmation) !== PRODUCTION_MIGRATION_CONFIRMATION) {
    return {
      ok: false,
      error: `Production preflight requires confirmation ${PRODUCTION_MIGRATION_CONFIRMATION}.`,
    };
  }

  const databaseUrl = normalized(input.databaseUrl);
  const productionDatabaseUrl = normalized(input.productionDatabaseUrl);
  const expectedHost = normalized(input.expectedHost).toLowerCase();
  const expectedDatabaseName = normalized(input.expectedDatabaseName);

  if (!databaseUrl || !productionDatabaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL and PRODUCTION_DATABASE_URL are both required.',
    };
  }

  if (databaseUrl !== productionDatabaseUrl) {
    return {
      ok: false,
      error: 'DATABASE_URL must exactly match PRODUCTION_DATABASE_URL.',
    };
  }

  if (!expectedHost || !expectedDatabaseName) {
    return {
      ok: false,
      error: 'PRODUCTION_DATABASE_HOST and PRODUCTION_DATABASE_NAME are required.',
    };
  }

  const url = parsePostgresUrl(productionDatabaseUrl);
  if (!url) {
    return {
      ok: false,
      error: 'PRODUCTION_DATABASE_URL must be a PostgreSQL URL.',
    };
  }

  const hostname = url.hostname.toLowerCase();

  if (PREVIEW_DATABASE_HOSTS.has(hostname) || PREVIEW_DATABASE_HOSTS.has(expectedHost)) {
    return {
      ok: false,
      error: 'Production preflight refuses the approved shared Preview database host.',
    };
  }

  if (hostname !== expectedHost) {
    return {
      ok: false,
      error: 'Production database host does not match PRODUCTION_DATABASE_HOST.',
    };
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (databaseName !== expectedDatabaseName) {
    return {
      ok: false,
      error: 'Production database name does not match PRODUCTION_DATABASE_NAME.',
    };
  }

  return {
    ok: true,
    productionDatabaseUrl,
    hostname,
    databaseName,
  };
}
