import 'server-only';

import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

const moderationSelect = {
  role: true,
  status: true,
  suspendedUntil: true,
  restrictionUntil: true,
  restrictionReason: true,
  sessionVersion: true,
} as const;

export async function getNormalizedAccountModerationState(userId: string) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    let state = await tx.user.findUnique({
      where: { id: userId },
      select: moderationSelect,
    });
    if (!state) return null;

    if (
      state.status === AccountStatus.SUSPENDED &&
      state.suspendedUntil &&
      state.suspendedUntil <= now
    ) {
      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          status: AccountStatus.SUSPENDED,
          suspendedUntil: { lte: now },
        },
        data: {
          status: AccountStatus.ACTIVE,
          suspendedUntil: null,
          restrictionUntil: null,
          restrictionReason: null,
        },
      });

      if (changed.count === 1) {
        return {
          ...state,
          status: AccountStatus.ACTIVE,
          suspendedUntil: null,
          restrictionUntil: null,
          restrictionReason: null,
        };
      }

      state = await tx.user.findUnique({
        where: { id: userId },
        select: moderationSelect,
      });
      if (!state) return null;
    }

    if (
      state.status === AccountStatus.POST_RESTRICTED &&
      state.restrictionUntil &&
      state.restrictionUntil <= now
    ) {
      const changed = await tx.user.updateMany({
        where: {
          id: userId,
          status: AccountStatus.POST_RESTRICTED,
          restrictionUntil: { lte: now },
        },
        data: {
          status: AccountStatus.ACTIVE,
          restrictionUntil: null,
          restrictionReason: null,
        },
      });

      if (changed.count === 1) {
        return {
          ...state,
          status: AccountStatus.ACTIVE,
          restrictionUntil: null,
          restrictionReason: null,
        };
      }

      state = await tx.user.findUnique({
        where: { id: userId },
        select: moderationSelect,
      });
    }

    return state;
  });
}
