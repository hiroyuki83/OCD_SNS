import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isSuspensionActive } from '@/lib/accountStatus';

export type FollowMutationResult =
  | { ok: true; state: 'NONE' | 'PENDING' | 'ACCEPTED' }
  | { ok: false; reason: 'NOT_FOUND' | 'BLOCKED' | 'INVALID' | 'CONFLICT' };

async function runFollowMutation(
  actorUserId: string,
  targetUserId: string,
  action: 'follow' | 'unfollow',
): Promise<FollowMutationResult> {
  return prisma.$transaction(
    async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          isPrivate: true,
          status: true,
          suspendedUntil: true,
        },
      });
      if (!target || isSuspensionActive(target.status, target.suspendedUntil)) {
        return { ok: false as const, reason: 'NOT_FOUND' as const };
      }

      if (action === 'unfollow') {
        await tx.follow.deleteMany({
          where: { followerId: actorUserId, followingId: targetUserId },
        });
        await tx.notification.deleteMany({
          where: {
            type: 'FOLLOW',
            userId: targetUserId,
            actorId: actorUserId,
          },
        });
        return { ok: true as const, state: 'NONE' as const };
      }

      const blocked = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: actorUserId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: actorUserId },
          ],
        },
        select: { id: true },
      });
      if (blocked) {
        return { ok: false as const, reason: 'BLOCKED' as const };
      }

      const existing = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: actorUserId,
            followingId: targetUserId,
          },
        },
        select: { id: true, acceptedAt: true },
      });

      let created = false;
      if (!existing) {
        await tx.follow.create({
          data: {
            followerId: actorUserId,
            followingId: targetUserId,
            acceptedAt: target.isPrivate ? null : new Date(),
          },
        });
        created = true;
      } else if (!target.isPrivate && !existing.acceptedAt) {
        await tx.follow.update({
          where: {
            followerId_followingId: {
              followerId: actorUserId,
              followingId: targetUserId,
            },
          },
          data: { acceptedAt: new Date() },
        });
      }

      const blockedAfterWrite = await tx.block.findFirst({
        where: {
          OR: [
            { blockerId: actorUserId, blockedId: targetUserId },
            { blockerId: targetUserId, blockedId: actorUserId },
          ],
        },
        select: { id: true },
      });
      if (blockedAfterWrite) {
        await tx.follow.deleteMany({
          where: { followerId: actorUserId, followingId: targetUserId },
        });
        return { ok: false as const, reason: 'BLOCKED' as const };
      }

      if (created) {
        await tx.notification.deleteMany({
          where: {
            type: 'FOLLOW',
            userId: targetUserId,
            actorId: actorUserId,
          },
        });
        await tx.notification.create({
          data: {
            type: 'FOLLOW',
            userId: targetUserId,
            actorId: actorUserId,
          },
        });
      }

      const current = await tx.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: actorUserId,
            followingId: targetUserId,
          },
        },
        select: { acceptedAt: true },
      });

      return {
        ok: true as const,
        state: current?.acceptedAt ? ('ACCEPTED' as const) : ('PENDING' as const),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function mutateFollowRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'follow' | 'unfollow',
): Promise<FollowMutationResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runFollowMutation(actorUserId, targetUserId, action);
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
      if (!retryable) throw error;
      if (attempt === 2) return { ok: false, reason: 'CONFLICT' };
    }
  }

  return { ok: false, reason: 'CONFLICT' };
}
