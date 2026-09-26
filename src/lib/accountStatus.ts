import { AccountStatus, type Prisma } from '@prisma/client';

export function isSuspensionActive(
  status: AccountStatus,
  suspendedUntil: Date | null,
  now: Date = new Date(),
) {
  return status === AccountStatus.SUSPENDED && (!suspendedUntil || suspendedUntil > now);
}

export function visibleAccountFilter(now: Date = new Date()): Prisma.UserWhereInput {
  return {
    OR: [
      { status: { not: AccountStatus.SUSPENDED } },
      {
        status: AccountStatus.SUSPENDED,
        suspendedUntil: { lte: now },
      },
    ],
  };
}
