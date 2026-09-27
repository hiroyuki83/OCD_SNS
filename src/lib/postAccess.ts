import 'server-only';

import type { Prisma } from '@prisma/client';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { prisma } from '@/lib/db';

export function accessiblePostWhere(
  viewerId: string | null,
  postId: string,
  now = new Date(),
): Prisma.PostWhereInput {
  const authorVisibility: Prisma.UserWhereInput = viewerId
    ? {
        AND: [
          visibleAccountFilter(now),
          {
            blocksInitiated: {
              none: { blockedId: viewerId },
            },
          },
          {
            blockedBy: {
              none: { blockerId: viewerId },
            },
          },
          {
            mutedBy: {
              none: { muterId: viewerId },
            },
          },
          {
            OR: [
              { isPrivate: false },
              { id: viewerId },
              {
                followers: {
                  some: {
                    followerId: viewerId,
                    acceptedAt: { not: null },
                  },
                },
              },
            ],
          },
        ],
      }
    : {
        AND: [
          visibleAccountFilter(now),
          { isPrivate: false },
        ],
      };

  return {
    id: postId,
    deletedAt: null,
    isHidden: false,
    author: authorVisibility,
  };
}

export async function getAccessiblePostForViewer(
  viewerId: string | null,
  postId: string,
) {
  return prisma.post.findFirst({
    where: accessiblePostWhere(viewerId, postId),
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
      isHidden: true,
      author: {
        select: {
          status: true,
          suspendedUntil: true,
          isPrivate: true,
        },
      },
    },
  });
}

export async function usersAreBlocked(userId: string, targetUserId: string) {
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: targetUserId },
        { blockerId: targetUserId, blockedId: userId },
      ],
    },
    select: { id: true },
  });

  return Boolean(blocked);
}
