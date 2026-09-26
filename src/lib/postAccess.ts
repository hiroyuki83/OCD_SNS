import 'server-only';

import { isSuspensionActive } from '@/lib/accountStatus';
import { prisma } from '@/lib/db';

export async function getAccessiblePostForViewer(viewerId: string | null, postId: string) {
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
          suspendedUntil: true,
          isPrivate: true,
        },
      },
    },
  });

  if (
    !post ||
    post.deletedAt ||
    post.isHidden ||
    isSuspensionActive(post.author.status, post.author.suspendedUntil)
  ) {
    return null;
  }

  if (post.authorId === viewerId) return post;

  if (!viewerId) {
    return post.author.isPrivate ? null : post;
  }

  const [blocked, muted] = await Promise.all([
    prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: post.authorId },
          { blockerId: post.authorId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
    prisma.mute.findFirst({
      where: { muterId: viewerId, mutedId: post.authorId },
      select: { id: true },
    }),
  ]);
  if (blocked || muted) return null;

  if (post.author.isPrivate) {
    const followsAuthor = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: post.authorId,
        },
      },
      select: { id: true, acceptedAt: true },
    });
    if (!followsAuthor?.acceptedAt) return null;
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
