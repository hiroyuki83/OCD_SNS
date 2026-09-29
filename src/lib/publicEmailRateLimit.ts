import 'server-only';

import { currentRequestClientIp } from '@/lib/requestClientIp';
import { rateLimit } from '@/lib/rateLimit';

const PUBLIC_EMAIL_IP_LIMIT = 20;
const PUBLIC_EMAIL_IP_WINDOW_MS = 60 * 60 * 1000;

export async function allowPublicEmailRequestFromCurrentIp() {
  const clientIp = await currentRequestClientIp();
  if (!clientIp) return true;

  return rateLimit(
    `public-email-ip:${clientIp}`,
    PUBLIC_EMAIL_IP_LIMIT,
    PUBLIC_EMAIL_IP_WINDOW_MS,
  );
}
