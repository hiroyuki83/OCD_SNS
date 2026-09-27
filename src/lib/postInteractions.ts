import 'server-only';

import { Prisma, ReactionType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isSuspensionActive } from '@/lib/accountStatus';

export type PostInteractionAction = 'like' | 'wakaru' | 'ganbatta' | 'bookmark';

type InteractionState =
  | { ok: true; active: boolean; count?: number }
  | { ok: false; reason: 'NOT_FOUND' | 'CONFLICT' };

class InteractionConflictError extends Error {}

async function getAccessiblePost(
  tx: Prisma.TransactionClient,
  viewerId: string,
  postId: string,
) {
  const post = await tx.post.findUnique({
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

  const [blocked, muted] = await Promise.all([
    tx.block.findFirst({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: post.authorId },
          { blockerId: post.authorId, blockedId: viewerId },
        ],
      },
      select: { id: true },
    }),
    tx.mute.findFirst({
      where: { muterId: viewerId, mutedId: post.authorId },
      select: { id: true },
    }),
  ]);
  if (blocked || muted) return null;

  if (post.author.isPrivate) {
    const follow = await tx.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: post.authorId,
        },
      },
      select: { acceptedAt: true },
    });
    if (!follow?.acceptedAt) return null;
  }

  return post;
}

async function toggleLike(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  authorId: string,
): Promise<InteractionState> {
  const removed = await tx.like.deleteMany({ where: { userId, postId } });
  if (removed.count > 0) {
    await tx.notification.deleteMany({
      where: { type: 'LIKE', userId: authorId, actorId: userId, postId },
    });
    const count = await tx.like.count({ where: { postId } });
    return { ok: true, active: false, count };
  }

  const created = await tx.like.createMany({
    data: [{ userId, postId }],
    skipDuplicates: true,
  });

  if (created.count === 1 && authorId !== userId) {
    await tx.notification.deleteMany({
      where: { type: 'LIKE', userId: authorId, actorId: userId, postId },
    });
    await tx.notification.create({
      data: { type: 'LIKE', userId: authorId, actorId: userId, postId },
    });
  }

  const count = await tx.like.count({ where: { postId } });
  return { ok: true, active: created.count === 1, count };
}

async function toggleBookmark(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
): Promise<InteractionState> {
  const removed = await tx.bookmark.deleteMany({ where: { userId, postId } });
  if (removed.count > 0) {
    return { ok: true, active: false };
  }

  const created = await tx.bookmark.createMany({
    data: [{ userId, postId }],
    skipDuplicates: true,
  });
  return { ok: true, active: created.count === 1 };
}

async function toggleReaction(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  authorId: string,
  type: ReactionType,
): Promise<InteractionState> {
  const removed = await tx.reaction.deleteMany({ where: { userId, postId, type } });
  let active = false;

  if (removed.count === 0) {
    const created = await tx.reaction.createMany({
      data: [{ userId, postId, type }],
      skipDuplicates: true,
    });
    active = created.count === 1;

    if (created.count === 1 && authorId !== userId) {
      await tx.notification.deleteMany({
        where: { type, userId: authorId, actorId: userId, postId },
      });
      await tx.notification.create({
        data: { type, userId: authorId, actorId: userId, postId },
      });
    }
  } else {
    await tx.notification.deleteMany({
      where: { type, userId: authorId, actorId: userId, postId },
    });
  }

  const count = await tx.reaction.count({ where: { postId, type } });
  const synced = await tx.post.updateMany({
    where: { id: postId, deletedAt: null, isHidden: false },
    data:
      type === ReactionType.WAKARU
        ? { wakaruCount: count }
        : { ganbattaCount: count },
  });
  if (synced.count !== 1) throw new InteractionConflictError();

  return { ok: true, active, count };
}

async function runOnce(
  userId: string,
  postId: string,
  action: PostInteractionAction,
): Promise<InteractionState> {
  return prisma.$transaction(
    async (tx) => {
      const post = await getAccessiblePost(tx, userId, postId);
      if (!post) return { ok: false as const, reason: 'NOT_FOUND' as const };

      if (action === 'like') {
        return toggleLike(tx, userId, postId, post.authorId);
      }
      if (action === 'bookmark') {
        return toggleBookmark(tx, userId, postId);
      }
      return toggleReaction(
        tx,
        userId,
        postId,
        post.authorId,
        action === 'wakaru' ? ReactionType.WAKARU : ReactionType.GANBATTA,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function togglePostInteraction(
  userId: string,
  postId: string,
  action: PostInteractionAction,
): Promise<InteractionState> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runOnce(userId, postId, action);
    } catch (error) {
      const retryable =
        error instanceof InteractionConflictError ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
      if (!retryable) throw error;
      if (attempt === 2) return { ok: false, reason: 'CONFLICT' };
    }
  }

  return { ok: false, reason: 'CONFLICT' };
}
