export type AppOriginEnv = {
  NEXTAUTH_URL?: string;
  AUTH_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
  E2E_EMAIL_MODE?: string;
};

function isLoopbackHostname(hostname: string) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}

function normalizeAbsoluteOrigin(
  value: string,
  allowLoopbackHttp: boolean,
): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Application origin is empty.');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Application origin must be an absolute URL.');
  }

  if (url.username || url.password) {
    throw new Error('Application origin must not include credentials.');
  }
  if (url.search || url.hash || url.pathname !== '/') {
    throw new Error('Application origin must not include a path, query, or fragment.');
  }

  if (url.protocol === 'https:') return url.origin;

  if (
    url.protocol === 'http:' &&
    allowLoopbackHttp &&
    isLoopbackHostname(url.hostname)
  ) {
    return url.origin;
  }

  throw new Error('Application origin must use HTTPS.');
}

function normalizeVercelHostname(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Vercel application hostname is empty.');
  if (trimmed.includes('://')) {
    throw new Error('Vercel application hostname must not include a protocol.');
  }
  return normalizeAbsoluteOrigin(`https://${trimmed}`, false);
}

export function resolveTrustedAppOrigin(env: AppOriginEnv): string {
  const allowLoopbackHttp =
    env.NODE_ENV !== 'production' || env.E2E_EMAIL_MODE === '1';

  const configuredOrigin = env.NEXTAUTH_URL ?? env.AUTH_URL;
  if (configuredOrigin !== undefined) {
    return normalizeAbsoluteOrigin(configuredOrigin, allowLoopbackHttp);
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL !== undefined) {
    return normalizeVercelHostname(env.VERCEL_PROJECT_PRODUCTION_URL);
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('Trusted application origin is not configured.');
  }

  if (env.VERCEL_URL !== undefined) {
    return normalizeVercelHostname(env.VERCEL_URL);
  }

  return 'http://localhost:3000';
}
