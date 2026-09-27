import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

export type RelationshipActionResult =
  | { ok: true; active: boolean }
  | { ok: false; reason: 'INVALID' | 'NOT_FOUND' | 'CONFLICT' };

async function runBlockMutation(
  actorUserId: string,
  targetUserId: string,
  action: 'block' | 'unblock',
): Promise<RelationshipActionResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) return { ok: false as const, reason: 'NOT_FOUND' as const };

      if (action === 'unblock') {
        await tx.block.deleteMany({
          where: { blockerId: actorUserId, blockedId: targetUserId },
        });
        return { ok: true as const, active: false };
      }

      await tx.block.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: actorUserId,
            blockedId: targetUserId,
          },
        },
        update: {},
        create: {
          blockerId: actorUserId,
          blockedId: targetUserId,
        },
      });

      await tx.follow.deleteMany({
        where: {
          OR: [
            { followerId: actorUserId, followingId: targetUserId },
            { followerId: targetUserId, followingId: actorUserId },
          ],
        },
      });

      await tx.notification.deleteMany({
        where: {
          OR: [
            { userId: targetUserId, actorId: actorUserId },
            { userId: actorUserId, actorId: targetUserId },
          ],
        },
      });

      return { ok: true as const, active: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function runMuteMutation(
  actorUserId: string,
  targetUserId: string,
  action: 'mute' | 'unmute',
): Promise<RelationshipActionResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });
      if (!target) return { ok: false as const, reason: 'NOT_FOUND' as const };

      if (action === 'unmute') {
        await tx.mute.deleteMany({
          where: { muterId: actorUserId, mutedId: targetUserId },
        });
        return { ok: true as const, active: false };
      }

      await tx.mute.upsert({
        where: {
          muterId_mutedId: {
            muterId: actorUserId,
            mutedId: targetUserId,
          },
        },
        update: {},
        create: {
          muterId: actorUserId,
          mutedId: targetUserId,
        },
      });

      await tx.notification.deleteMany({
        where: {
          userId: actorUserId,
          actorId: targetUserId,
        },
      });

      return { ok: true as const, active: true };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function retryRelationshipMutation(
  run: () => Promise<RelationshipActionResult>,
): Promise<RelationshipActionResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable) throw error;
      if (attempt === 2) return { ok: false, reason: 'CONFLICT' };
    }
  }
  return { ok: false, reason: 'CONFLICT' };
}

export async function mutateBlockRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'block' | 'unblock',
): Promise<RelationshipActionResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }
  return retryRelationshipMutation(() =>
    runBlockMutation(actorUserId, targetUserId, action),
  );
}

export async function mutateMuteRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'mute' | 'unmute',
): Promise<RelationshipActionResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }
  return retryRelationshipMutation(() =>
    runMuteMutation(actorUserId, targetUserId, action),
  );
}
