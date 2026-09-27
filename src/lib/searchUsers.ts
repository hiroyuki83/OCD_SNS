import type { Prisma } from '@prisma/client';
import { visibleAccountFilter } from '@/lib/accountStatus';

export function normalizeUserSearchTerm(query: string) {
  const value = query.startsWith('@') ? query.slice(1) : query;
  return value.trim();
}

export function searchableUserWhere(
  viewerId: string | null,
  query: string,
  now: Date,
): Prisma.UserWhereInput {
  const term = normalizeUserSearchTerm(query);
  const visibility: Prisma.UserWhereInput[] = [visibleAccountFilter(now)];

  if (viewerId) {
    visibility.push(
      { blocksInitiated: { none: { blockedId: viewerId } } },
      { blockedBy: { none: { blockerId: viewerId } } },
      { mutedBy: { none: { muterId: viewerId } } },
    );
  }

  return {
    AND: [
      ...visibility,
      {
        OR: [
          { handle: { contains: term, mode: 'insensitive' } },
          { name: { contains: term, mode: 'insensitive' } },
          { bio: { contains: term, mode: 'insensitive' } },
        ],
      },
    ],
  };
}
