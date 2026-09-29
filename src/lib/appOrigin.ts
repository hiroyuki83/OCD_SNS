import 'server-only';

import { resolveTrustedAppOrigin } from '@/lib/appOriginCore';

export function appOrigin() {
  return resolveTrustedAppOrigin(process.env);
}
