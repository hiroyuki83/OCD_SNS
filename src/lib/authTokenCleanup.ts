import 'server-only';

import { prisma } from '@/lib/db';
import { logOperationalError } from '@/lib/operationalError';

export async function cleanupExpiredAuthTokens(now = new Date()) {
  try {
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { expiresAt: { lte: now } },
      }),
    ]);
  } catch (error) {
    logOperationalError('AUTH_TOKEN_CLEANUP_FAILED', error);
  }
}
