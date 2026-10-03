export type DatabaseUrlEnv = {
  [key: string]: string | undefined;
  VERCEL_ENV?: string;
  PREVIEW_DATABASE_URL?: string;
  DATABASE_URL?: string;
  POSTGRES_PRISMA_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;
};

function firstNonEmpty(...values: Array<string | undefined | null>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function selectRuntimeDatabaseUrl(env: DatabaseUrlEnv) {
  if (env.VERCEL_ENV?.trim() === 'preview') {
    return firstNonEmpty(env.PREVIEW_DATABASE_URL);
  }

  return firstNonEmpty(
    env.DATABASE_URL,
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL_NON_POOLING,
  );
}

export function selectMigrationDatabaseUrl(env: DatabaseUrlEnv) {
  if (env.VERCEL_ENV?.trim() === 'preview') {
    return firstNonEmpty(env.PREVIEW_DATABASE_URL);
  }

  return firstNonEmpty(
    env.POSTGRES_URL_NON_POOLING,
    env.DATABASE_URL,
    env.POSTGRES_PRISMA_URL,
  );
}

export function normalizePostgresSslMode(value: string | undefined | null) {
  const trimmed = value?.trim();
  if (!trimmed) return trimmed ?? '';

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      return trimmed;
    }

    const sslMode = url.searchParams.get('sslmode')?.toLowerCase();
    if (sslMode === 'require' || sslMode === 'prefer' || sslMode === 'verify-ca') {
      url.searchParams.set('sslmode', 'verify-full');
      return url.toString();
    }

    return trimmed;
  } catch {
    return trimmed;
  }
}
