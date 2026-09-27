'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

function normalizeAppealText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

const AppealSchema = z.object({
  warningId: z.string().trim().min(1).max(128),
  message: z
    .string()
    .transform(normalizeAppealText)
    .refine((value) => Array.from(value).length >= 10, '異議申立ての理由を10文字以上で入力してください。')
    .refine((value) => Array.from(value).length <= 1000, '異議申立ては1000文字以内です。'),
});

export type WarningAppealSubmitState =
  | { ok?: boolean; message?: string; errors?: { message?: string[] } }
  | undefined;

export async function submitWarningAppeal(
  _prevState: WarningAppealSubmitState,
  formData: FormData,
): Promise<WarningAppealSubmitState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { message: 'ログインしてください。' };

  if (!(await rateLimit(`warning-appeal:${userId}`, 5, 24 * 60 * 60 * 1000))) {
    return { message: '異議申立ての送信回数が多すぎます。時間をおいて再度お試しください。' };
  }

  const parsed = AppealSchema.safeParse({
    warningId: formData.get('warningId'),
    message: formData.get('message'),
  });
  if (!parsed.success) {
    const flattened = parsed.error.flatten();
    return {
      message: '入力内容を確認してください。',
      errors: { message: flattened.fieldErrors.message },
    };
  }

  const warning = await prisma.moderationWarning.findFirst({
    where: {
      id: parsed.data.warningId,
      targetUserId: userId,
    },
    select: {
      id: true,
      targetUserId: true,
      revokedAt: true,
      appeal: { select: { id: true } },
    },
  });
  if (!warning) return { message: '対象の警告が見つかりません。' };
  if (warning.revokedAt) {
    return { message: 'この警告は既に取り消されているため、異議申立ては不要です。' };
  }
  if (warning.appeal) {
    return { message: 'この警告には既に異議申立てが送信されています。' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const eligibleWarning = await tx.moderationWarning.updateMany({
        where: {
          id: warning.id,
          targetUserId: userId,
          revokedAt: null,
        },
        data: { readAt: new Date() },
      });
      if (eligibleWarning.count !== 1) {
        throw new Error('WARNING_APPEAL_STATE_CHANGED');
      }

      const appeal = await tx.warningAppeal.create({
        data: {
          warningId: warning.id,
          userId,
          message: parsed.data.message,
        },
        select: { id: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'WARNING_APPEAL_SUBMITTED',
          actorUserId: userId,
          targetUserId: userId,
          meta: {
            warningId: warning.id,
            appealId: appeal.id,
          },
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { message: 'この警告には既に異議申立てが送信されています。' };
    }
    if (error instanceof Error && error.message === 'WARNING_APPEAL_STATE_CHANGED') {
      return { message: '警告の状態が変更されました。画面を更新して再度お試しください。' };
    }
    throw error;
  }

  revalidatePath('/notifications');
  revalidatePath('/admin/audit');
  return { ok: true, message: '異議申立てを送信しました。審査結果は通知画面に表示されます。' };
}
