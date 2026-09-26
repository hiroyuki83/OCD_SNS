import 'server-only';

import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/db';

export async function getAccessiblePostForViewer(viewerId: string, postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
      isHidden: true,
      author: {
        select: {
          status: true,
          isPrivate: true,
        },
      },
    },
  });

  if (
    !post ||
    post.deletedAt ||
    post.isHidden ||
    post.author.status === AccountStatus.SUSPENDED
  ) {
    return null;
  }

  if (post.authorId === viewerId) return post;

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: post.authorId },
        { blockerId: post.authorId, blockedId: viewerId },
      ],
    },
    select: { id: true },
  });
  if (blocked) return null;

  if (post.author.isPrivate) {
    const followsAuthor = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: post.authorId,
        },
      },
      select: { id: true },
    });
    if (!followsAuthor) return null;
  }

  return post;
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
