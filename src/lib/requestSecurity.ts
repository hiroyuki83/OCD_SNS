import 'server-only';

type MutationCheck =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 415; error: string };

function expectedOrigins(request: Request) {
  const requestUrl = new URL(request.url);
  const origins = new Set<string>([requestUrl.origin]);

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || request.headers.get('host')?.trim();
  if (host) {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto || requestUrl.protocol.replace(':', '');
    origins.add(`${proto}://${host}`);
  }

  return origins;
}

export function validateJsonMutationRequest(request: Request): MutationCheck {
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return { ok: false, status: 403, error: 'Cross-site request blocked.' };
  }

  const origin = request.headers.get('origin');
  if (origin) {
    let normalizedOrigin: string;
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      return { ok: false, status: 400, error: 'Invalid Origin header.' };
    }

    if (!expectedOrigins(request).has(normalizedOrigin)) {
      return { ok: false, status: 403, error: 'Origin is not allowed.' };
    }
  } else if (secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return { ok: false, status: 403, error: 'Origin verification required.' };
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return { ok: false, status: 415, error: 'Content-Type must be application/json.' };
  }

  return { ok: true };
}
