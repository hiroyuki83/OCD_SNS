export const MAX_JSON_MUTATION_BYTES = 16 * 1024;

export type RequestPayloadFailure = {
  ok: false;
  status: 400 | 413;
  error: string;
};

export type RequestPayloadSuccess<T> = {
  ok: true;
  data: T;
};

export function validateContentLength(
  rawValue: string | null,
  maxBytes: number = MAX_JSON_MUTATION_BYTES,
): { ok: true } | RequestPayloadFailure {
  if (rawValue === null || rawValue === '') return { ok: true };
  if (!/^\\d+$/.test(rawValue)) {
    return { ok: false, status: 400, error: 'Invalid Content-Length header.' };
  }

  const contentLength = Number(rawValue);
  if (!Number.isSafeInteger(contentLength)) {
    return { ok: false, status: 400, error: 'Invalid Content-Length header.' };
  }
  if (contentLength > maxBytes) {
    return { ok: false, status: 413, error: 'Request body is too large.' };
  }

  return { ok: true };
}

export function utf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export function parseJsonText<T = unknown>(
  rawText: string,
  maxBytes: number = MAX_JSON_MUTATION_BYTES,
): RequestPayloadSuccess<T> | RequestPayloadFailure {
  if (utf8ByteLength(rawText) > maxBytes) {
    return { ok: false, status: 413, error: 'Request body is too large.' };
  }
  if (!rawText.trim()) {
    return { ok: false, status: 400, error: 'JSON body is required.' };
  }

  try {
    return { ok: true, data: JSON.parse(rawText) as T };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body.' };
  }
}
