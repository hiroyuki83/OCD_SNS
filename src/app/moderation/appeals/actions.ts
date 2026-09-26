'use server';

import { revalidatePath } from 'next/cache';
import { Role, WarningAppealStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';

const ReviewSchema = z.object({
  note: z
    .string()
    .trim()
    .min(5, '審査理由を5文字以上で入力してください。')
    .max(500, '審査理由は500文字以内です。'),
});

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
      warning: { select: { actorUserId: true } },
    },
  });
  if (!appeal || appeal.status !== WarningAppealStatus.PENDING) return;
  if (appeal.userId === actor.id) return;
  if (actor.role !== Role.ADMIN && appeal.user.role !== Role.USER) return;

  const reviewedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.warningAppeal.update({
      where: { id: appeal.id },
      data: {
        status: outcome,
        resolutionNote: parsed.data.note,
        reviewedAt,
        reviewerId: actor.id,
      },
    });

    await tx.moderationWarning.update({
      where: { id: appeal.warningId },
      data: {
        readAt: null,
        ...(outcome === WarningAppealStatus.OVERTURNED
          ? { revokedAt: reviewedAt }
          : {}),
      },
    });

    await tx.auditLog.create({
      data: {
        action: 'WARNING_APPEAL_REVIEWED',
        actorUserId: actor.id,
        targetUserId: appeal.userId,
        meta: {
          appealId: appeal.id,
          warningId: appeal.warningId,
          outcome,
          note: parsed.data.note,
        },
      },
    });
  });

  revalidatePath('/moderation/appeals');
  revalidatePath('/notifications');
  revalidatePath(`/admin/users/${appeal.userId}`);
  revalidatePath('/admin/audit');
}
