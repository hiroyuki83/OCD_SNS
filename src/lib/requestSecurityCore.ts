import {
  MAX_JSON_MUTATION_BYTES,
  parseJsonText,
  validateContentLength,
} from '@/lib/requestPayload';

type MutationStatus = 400 | 403 | 413 | 415;

type MutationCheck =
  | { ok: true }
  | { ok: false; status: MutationStatus; error: string };

type ParsedMutation<T> =
  | { ok: true; data: T }
  | { ok: false; status: MutationStatus; error: string };

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

export function validateJsonMutationRequest(
  request: Request,
  maxBytes: number = MAX_JSON_MUTATION_BYTES,
): MutationCheck {
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

  const contentLengthCheck = validateContentLength(request.headers.get('content-length'), maxBytes);
  if (!contentLengthCheck.ok) return contentLengthCheck;

  return { ok: true };
}

export async function parseJsonMutationRequest<T = unknown>(
  request: Request,
  maxBytes: number = MAX_JSON_MUTATION_BYTES,
): Promise<ParsedMutation<T>> {
  const requestCheck = validateJsonMutationRequest(request, maxBytes);
  if (!requestCheck.ok) return requestCheck;

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Unable to read request body.' };
  }

  return parseJsonText<T>(rawText, maxBytes);
}
