import 'server-only';

import { headers } from 'next/headers';

import { clientIpFromHeaders } from '@/lib/clientIpCore';

export async function currentRequestClientIp() {
  return clientIpFromHeaders(await headers());
}
