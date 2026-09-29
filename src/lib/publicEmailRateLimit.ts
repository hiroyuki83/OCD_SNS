import 'server-only';

import { headers } from 'next/headers';

import { clientIpFromHeaders } from '@/lib/clientIpCore';
import { rateLimit } from '@/lib/rateLimit';

const PUBLIC_EMAIL_IP_LIMIT = 20;
const PUBLIC_EMAIL_IP_WINDOW_MS = 60 * 60 * 1000;

export async function allowPublicEmailRequestFromCurrentIp() {
  const requestHeaders = await headers();
  const clientIp = clientIpFromHeaders(requestHeaders);
  if (!clientIp) return true;

  return rateLimit(
    `public-email-ip:${clientIp}`,
    PUBLIC_EMAIL_IP_LIMIT,
    PUBLIC_EMAIL_IP_WINDOW_MS,
  );
}
