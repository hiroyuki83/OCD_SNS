import 'server-only';

import { NextResponse } from 'next/server';

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  Pragma: 'no-cache',
} as const;

export function privateJson<T>(
  data: T,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(PRIVATE_NO_STORE_HEADERS)) {
    headers.set(key, value);
  }

  return NextResponse.json(data, {
    ...init,
    headers,
  });
}
