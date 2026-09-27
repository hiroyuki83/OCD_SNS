import 'server-only';

import { prisma } from '@/lib/db';

export type RelationshipActionResult =
  | { ok: true; active: boolean }
  | { ok: false; reason: 'INVALID' | 'NOT_FOUND' };

export async function mutateBlockRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'block' | 'unblock',
): Promise<RelationshipActionResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }

  return prisma.$transaction(async (tx) => {
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
  });
}

export async function mutateMuteRelation(
  actorUserId: string,
  targetUserId: string,
  action: 'mute' | 'unmute',
): Promise<RelationshipActionResult> {
  if (!actorUserId || !targetUserId || actorUserId === targetUserId) {
    return { ok: false, reason: 'INVALID' };
  }

  return prisma.$transaction(async (tx) => {
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
  });
}
