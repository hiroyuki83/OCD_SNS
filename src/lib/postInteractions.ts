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
          notifyLikes: true,
          notifyReactions: true,
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
  notifyLikes: boolean,
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

  if (created.count === 1 && authorId !== userId && notifyLikes) {
    await tx.notification.deleteMany({
      where: { type: 'LIKE', userId: authorId, actorId: userId, postId },
    });
    await tx.notification.create({
      data: { type: 'LIKE', userId: authorId, actorId: userId, postId },
    });
  }

  const [count, currentLike] = await Promise.all([
    tx.like.count({ where: { postId } }),
    tx.like.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true },
    }),
  ]);
  return { ok: true, active: Boolean(currentLike), count };
}

async function toggleBookmark(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
): Promise<InteractionState> {
  const removed = await tx.bookmark.deleteMany({ where: { userId, postId } });
  if (removed.count > 0) {
    const count = await tx.bookmark.count({ where: { postId } });
    return { ok: true, active: false, count };
  }

  await tx.bookmark.createMany({
    data: [{ userId, postId }],
    skipDuplicates: true,
  });
  const [currentBookmark, count] = await Promise.all([
    tx.bookmark.findUnique({
      where: { userId_postId: { userId, postId } },
      select: { id: true },
    }),
    tx.bookmark.count({ where: { postId } }),
  ]);
  return { ok: true, active: Boolean(currentBookmark), count };
}

async function toggleReaction(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  authorId: string,
  type: ReactionType,
  notifyReactions: boolean,
): Promise<InteractionState> {
  const removed = await tx.reaction.deleteMany({ where: { userId, postId, type } });
  if (removed.count === 0) {
    const created = await tx.reaction.createMany({
      data: [{ userId, postId, type }],
      skipDuplicates: true,
    });
    if (created.count === 1 && authorId !== userId && notifyReactions) {
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

  const [count, currentReaction] = await Promise.all([
    tx.reaction.count({ where: { postId, type } }),
    tx.reaction.findUnique({
      where: { userId_postId_type: { userId, postId, type } },
      select: { id: true },
    }),
  ]);
  const synced = await tx.post.updateMany({
    where: { id: postId, deletedAt: null, isHidden: false },
    data:
      type === ReactionType.WAKARU
        ? { wakaruCount: count }
        : { ganbattaCount: count },
  });
  if (synced.count !== 1) throw new InteractionConflictError();

  return { ok: true, active: Boolean(currentReaction), count };
}

async function runOnce(
  userId: string,
  postId: string,
  action: PostInteractionAction,
): Promise<InteractionState> {
  return prisma.$transaction(
    async (tx) => {
      const viewer = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, suspendedUntil: true },
      });
      if (
        !viewer ||
        isSuspensionActive(viewer.status, viewer.suspendedUntil)
      ) {
        return { ok: false as const, reason: 'NOT_FOUND' as const };
      }

      const post = await getAccessiblePost(tx, userId, postId);
      if (!post) return { ok: false as const, reason: 'NOT_FOUND' as const };

      if (action === 'like') {
        return toggleLike(tx, userId, postId, post.authorId, post.author.notifyLikes);
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
        post.author.notifyReactions,
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

export type DesiredPostInteractionAction = PostInteractionAction;

async function setLikeState(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  active: boolean,
): Promise<InteractionState> {
  if (active) {
    await tx.like.createMany({
      data: [{ userId, postId }],
      skipDuplicates: true,
    });
  } else {
    await tx.like.deleteMany({ where: { userId, postId } });
  }

  const count = await tx.like.count({ where: { postId } });
  return { ok: true, active, count };
}

async function setBookmarkState(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  active: boolean,
): Promise<InteractionState> {
  if (active) {
    await tx.bookmark.createMany({
      data: [{ userId, postId }],
      skipDuplicates: true,
    });
  } else {
    await tx.bookmark.deleteMany({ where: { userId, postId } });
  }

  return { ok: true, active };
}

async function setReactionState(
  tx: Prisma.TransactionClient,
  userId: string,
  postId: string,
  type: ReactionType,
  active: boolean,
): Promise<InteractionState> {
  if (active) {
    await tx.reaction.createMany({
      data: [{ userId, postId, type }],
      skipDuplicates: true,
    });
  } else {
    await tx.reaction.deleteMany({
      where: { userId, postId, type },
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

async function runDesiredStateOnce(
  userId: string,
  postId: string,
  action: DesiredPostInteractionAction,
  active: boolean,
): Promise<InteractionState> {
  return prisma.$transaction(
    async (tx) => {
      const viewer = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, suspendedUntil: true },
      });
      if (
        !viewer ||
        isSuspensionActive(viewer.status, viewer.suspendedUntil)
      ) {
        return { ok: false as const, reason: 'NOT_FOUND' as const };
      }

      const post = await getAccessiblePost(tx, userId, postId);
      if (!post) return { ok: false as const, reason: 'NOT_FOUND' as const };

      if (action === 'like') {
        return setLikeState(tx, userId, postId, active);
      }
      if (action === 'bookmark') {
        return setBookmarkState(tx, userId, postId, active);
      }
      return setReactionState(
        tx,
        userId,
        postId,
        action === 'wakaru' ? ReactionType.WAKARU : ReactionType.GANBATTA,
        active,
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function setPostInteraction(
  userId: string,
  postId: string,
  action: DesiredPostInteractionAction,
  active: boolean,
): Promise<InteractionState> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runDesiredStateOnce(userId, postId, action, active);
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

export async function syncPostInteractionNotification(
  userId: string,
  postId: string,
  action: DesiredPostInteractionAction,
) {
  if (action === 'bookmark') return;

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
      isHidden: true,
      author: {
        select: {
          notifyLikes: true,
          notifyReactions: true,
        },
      },
    },
  });

  if (!post || post.deletedAt || post.isHidden || post.authorId === userId) {
    if (post) {
      await prisma.notification.deleteMany({
        where: {
          userId: post.authorId,
          actorId: userId,
          postId,
          type:
            action === 'like'
              ? 'LIKE'
              : action === 'wakaru'
                ? ReactionType.WAKARU
                : ReactionType.GANBATTA,
        },
      });
    }
    return;
  }

  const notificationType =
    action === 'like'
      ? 'LIKE'
      : action === 'wakaru'
        ? ReactionType.WAKARU
        : ReactionType.GANBATTA;

  const active =
    action === 'like'
      ? Boolean(
          await prisma.like.findUnique({
            where: { userId_postId: { userId, postId } },
            select: { id: true },
          }),
        )
      : Boolean(
          await prisma.reaction.findUnique({
            where: {
              userId_postId_type: {
                userId,
                postId,
                type:
                  action === 'wakaru'
                    ? ReactionType.WAKARU
                    : ReactionType.GANBATTA,
              },
            },
            select: { id: true },
          }),
        );

  const notificationsEnabled =
    action === 'like'
      ? post.author.notifyLikes
      : post.author.notifyReactions;

  await prisma.notification.deleteMany({
    where: {
      type: notificationType,
      userId: post.authorId,
      actorId: userId,
      postId,
    },
  });

  if (active && notificationsEnabled) {
    await prisma.notification.create({
      data: {
        type: notificationType,
        userId: post.authorId,
        actorId: userId,
        postId,
      },
    });
  }
}

