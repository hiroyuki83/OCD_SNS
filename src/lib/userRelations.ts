import 'server-only';

import { AccountStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isSuspensionActive } from '@/lib/accountStatus';

export type FollowMutationResult =
  | { ok: true; state: 'NONE' | 'PENDING' | 'ACCEPTED' }
  | { ok: false; reason: 'NOT_FOUND' | 'BLOCKED' | 'INVALID' };

export async function mutateFollowRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'follow' | 'unfollow',
): Promise<FollowMutationResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }

  return prisma.$transaction(async (tx) => {
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
  });
}

export async function activateExpiredSuspension(userId: string) {
  const now = new Date();
  const changed = await prisma.user.updateMany({
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
  return changed.count === 1;
}
