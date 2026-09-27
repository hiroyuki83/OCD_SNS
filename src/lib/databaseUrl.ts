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
