'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, Role, WarningAppealStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';

function normalizeReviewText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

const ReviewSchema = z.object({
  note: z
    .string()
    .transform(normalizeReviewText)
    .refine((value) => Array.from(value).length >= 5, '審査理由を5文字以上で入力してください。')
    .refine((value) => Array.from(value).length <= 500, '審査理由は500文字以内です。'),
});

class AppealReviewConflictError extends Error {}

export async function upholdWarningAppeal(appealId: string, formData: FormData) {
  return reviewWarningAppeal(appealId, WarningAppealStatus.UPHELD, formData);
}

export async function overturnWarningAppeal(appealId: string, formData: FormData) {
  return reviewWarningAppeal(appealId, WarningAppealStatus.OVERTURNED, formData);
}

export async function reviewWarningAppeal(
  appealId: string,
  outcome: WarningAppealStatus,
  formData: FormData,
) {
  appealId = appealId.trim();
  if (!appealId || appealId.length > 128) return;
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  if (!(await rateLimit(`appeal-review:${actor.id}`, 60, 60 * 60 * 1000))) return;
  if (outcome !== WarningAppealStatus.UPHELD && outcome !== WarningAppealStatus.OVERTURNED) {
    return;
  }

  const parsed = ReviewSchema.safeParse({ note: formData.get('note') });
  if (!parsed.success) return;

  const appeal = await prisma.warningAppeal.findUnique({
    where: { id: appealId },
    select: {
      id: true,
      status: true,
      userId: true,
      warningId: true,
      user: { select: { role: true } },
      warning: { select: { actorUserId: true, revokedAt: true } },
    },
  });
  if (!appeal || appeal.status !== WarningAppealStatus.PENDING) return;
  if (appeal.userId === actor.id) return;
  if (actor.role !== Role.ADMIN && appeal.user.role !== Role.USER) return;
  if (appeal.warning.actorUserId === actor.id) return;
  if (appeal.warning.revokedAt && outcome === WarningAppealStatus.UPHELD) return;

  const reviewedAt = new Date();

  let reviewed = false;
  try {
    reviewed = await prisma.$transaction(
      async (tx) => {
        const currentActor = await tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true },
        });
        if (
          !currentActor ||
          (currentActor.role !== Role.ADMIN && currentActor.role !== Role.MODERATOR)
        ) {
          return false;
        }

        const currentAppeal = await tx.warningAppeal.findUnique({
          where: { id: appeal.id },
          select: {
            status: true,
            userId: true,
            warningId: true,
            user: { select: { role: true } },
            warning: { select: { actorUserId: true, revokedAt: true } },
          },
        });
        if (!currentAppeal || currentAppeal.status !== WarningAppealStatus.PENDING) return false;
        if (currentAppeal.userId === actor.id) return false;
        if (currentActor.role !== Role.ADMIN && currentAppeal.user.role !== Role.USER) return false;
        if (currentAppeal.warning.actorUserId === actor.id) return false;
        if (
          currentAppeal.warning.revokedAt &&
          outcome === WarningAppealStatus.UPHELD
        ) {
          return false;
        }

        const claimed = await tx.warningAppeal.updateMany({
          where: { id: appeal.id, status: WarningAppealStatus.PENDING },
          data: {
            status: outcome,
            resolutionNote: parsed.data.note,
            reviewedAt,
            reviewerId: actor.id,
          },
        });
        if (claimed.count !== 1) return false;

        if (outcome === WarningAppealStatus.UPHELD) {
          const warningUpdated = await tx.moderationWarning.updateMany({
            where: {
              id: currentAppeal.warningId,
              revokedAt: null,
            },
            data: { readAt: null },
          });
          if (warningUpdated.count !== 1) throw new AppealReviewConflictError();
        } else {
          await tx.moderationWarning.update({
            where: { id: currentAppeal.warningId },
            data: {
              readAt: null,
              revokedAt: currentAppeal.warning.revokedAt ?? reviewedAt,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'WARNING_APPEAL_REVIEWED',
            actorUserId: actor.id,
            targetUserId: appeal.userId,
            meta: {
              appealId: appeal.id,
              warningId: currentAppeal.warningId,
              outcome,
              note: parsed.data.note,
            },
          },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof AppealReviewConflictError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
    ) {
      return;
    }
    throw error;
  }

  if (!reviewed) return;

  revalidatePath('/moderation/appeals');
  revalidatePath('/notifications');
  revalidatePath(`/admin/users/${appeal.userId}`);
  revalidatePath('/admin/audit');
}
