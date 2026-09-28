'use server';

import { revalidatePath } from 'next/cache';
import {
  AccountStatus,
  AppealStatus,
  Prisma,
  Role,
  SanctionStatus,
  SanctionType,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { rateLimit } from '@/lib/rateLimit';
import { isEmailDeliveryConfigured, sendTransactionalEmail } from '@/lib/email';
import { logOperationalError } from '@/lib/operationalError';

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

function accountStatusForSanction(type: SanctionType) {
  if (type === SanctionType.POST_RESTRICTION) return AccountStatus.POST_RESTRICTED;
  if (type === SanctionType.SUSPENSION) return AccountStatus.SUSPENDED;
  return null;
}

export async function upholdSanctionAppeal(appealId: string, formData: FormData) {
  return reviewSanctionAppeal(appealId, AppealStatus.UPHELD, formData);
}

export async function overturnSanctionAppeal(appealId: string, formData: FormData) {
  return reviewSanctionAppeal(appealId, AppealStatus.OVERTURNED, formData);
}

export async function reviewSanctionAppeal(
  appealId: string,
  outcome: AppealStatus,
  formData: FormData,
) {
  appealId = appealId.trim();
  if (!appealId || appealId.length > 128) return;

  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  if (!(await rateLimit(`sanction-appeal-review:${actor.id}`, 60, 60 * 60 * 1000))) {
    return;
  }

  if (outcome !== AppealStatus.UPHELD && outcome !== AppealStatus.OVERTURNED) return;

  const parsed = ReviewSchema.safeParse({ note: formData.get('note') });
  if (!parsed.success) return;

  const reviewedAt = new Date();

  let result:
    | {
        userId: string;
        email: string;
        sanctionType: SanctionType;
        outcome: AppealStatus;
        note: string;
      }
    | null = null;

  try {
    result = await prisma.$transaction(
      async (tx) => {
        const currentActor = await tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true },
        });
        if (
          !currentActor ||
          (currentActor.role !== Role.ADMIN && currentActor.role !== Role.MODERATOR)
        ) {
          return null;
        }

        const appeal = await tx.appeal.findUnique({
          where: { id: appealId },
          select: {
            id: true,
            status: true,
            userId: true,
            sanctionId: true,
            user: {
              select: {
                role: true,
                email: true,
              },
            },
            sanction: {
              select: {
                actorUserId: true,
                targetUserId: true,
                type: true,
                status: true,
                endsAt: true,
              },
            },
          },
        });

        if (!appeal || appeal.status !== AppealStatus.PENDING) return null;
        if (appeal.userId === actor.id) return null;
        if (appeal.sanction.targetUserId !== appeal.userId) return null;
        if (appeal.sanction.actorUserId === actor.id) return null;
        if (currentActor.role !== Role.ADMIN && appeal.user.role !== Role.USER) return null;
        if (
          outcome === AppealStatus.UPHELD &&
          appeal.sanction.status === SanctionStatus.REVOKED
        ) {
          return null;
        }

        const claimed = await tx.appeal.updateMany({
          where: {
            id: appeal.id,
            status: AppealStatus.PENDING,
          },
          data: {
            status: outcome,
            resolutionNote: parsed.data.note,
            reviewedAt,
            reviewerId: actor.id,
          },
        });
        if (claimed.count !== 1) return null;

        if (outcome === AppealStatus.OVERTURNED) {
          await tx.sanction.updateMany({
            where: {
              id: appeal.sanctionId,
              status: { not: SanctionStatus.REVOKED },
            },
            data: {
              status: SanctionStatus.REVOKED,
              revokedAt: reviewedAt,
            },
          });

          const expectedStatus = accountStatusForSanction(appeal.sanction.type);
          if (expectedStatus) {
            const otherActive = await tx.sanction.findFirst({
              where: {
                targetUserId: appeal.userId,
                id: { not: appeal.sanctionId },
                status: SanctionStatus.ACTIVE,
                OR: [{ endsAt: null }, { endsAt: { gt: reviewedAt } }],
              },
              select: { id: true },
            });

            if (!otherActive) {
              await tx.user.updateMany({
                where: {
                  id: appeal.userId,
                  status: expectedStatus,
                },
                data: {
                  status: AccountStatus.ACTIVE,
                  suspendedUntil: null,
                  restrictionUntil: null,
                  restrictionReason: null,
                },
              });
            }
          }
        } else if (
          appeal.sanction.status === SanctionStatus.ACTIVE &&
          appeal.sanction.endsAt &&
          appeal.sanction.endsAt <= reviewedAt
        ) {
          await tx.sanction.updateMany({
            where: {
              id: appeal.sanctionId,
              status: SanctionStatus.ACTIVE,
              endsAt: { lte: reviewedAt },
            },
            data: { status: SanctionStatus.EXPIRED },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'SANCTION_APPEAL_REVIEWED',
            actorUserId: actor.id,
            targetUserId: appeal.userId,
            meta: {
              appealId: appeal.id,
              sanctionId: appeal.sanctionId,
              sanctionType: appeal.sanction.type,
              outcome,
              note: parsed.data.note,
            },
          },
        });

        return {
          userId: appeal.userId,
          email: appeal.user.email,
          sanctionType: appeal.sanction.type,
          outcome,
          note: parsed.data.note,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      return;
    }
    throw error;
  }

  if (!result) return;

  if (isEmailDeliveryConfigured()) {
    const sanctionLabel =
      result.sanctionType === SanctionType.SUSPENSION
        ? 'アカウント停止'
        : '投稿制限';
    const outcomeLabel =
      result.outcome === AppealStatus.OVERTURNED ? '処分取消' : '処分維持';

    try {
      await sendTransactionalEmail({
        to: result.email,
        subject: 'CoCo 異議申立ての審査結果',
        text: [
          '処分への異議申立ての審査が完了しました。',
          '',
          `対象: ${sanctionLabel}`,
          `結果: ${outcomeLabel}`,
          `審査理由: ${result.note}`,
          '',
          '必要に応じて、CoCoの異議申立てページから現在の状態を確認できます。',
        ].join('\n'),
      });
    } catch (error) {
      logOperationalError('SANCTION_APPEAL_RESULT_EMAIL_FAILED', error);
    }
  }

  revalidatePath('/moderation/appeals/sanctions');
  revalidatePath(`/admin/users/${result.userId}`);
  revalidatePath('/admin/audit');
}
