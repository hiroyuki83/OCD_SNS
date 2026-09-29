export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return null;

  const first = forwarded.split(',', 1)[0]?.trim();
  if (!first || first.length > 128) return null;
  if (/[\u0000-\u001F\u007F]/.test(first)) return null;

  return first.toLowerCase();
}
