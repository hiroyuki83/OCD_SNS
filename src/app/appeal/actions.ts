'use server';

import bcrypt from 'bcryptjs';
import {
  AppealStatus,
  Prisma,
  SanctionStatus,
  SanctionType,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

const DUMMY_PASSWORD_HASH =
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

function normalizeAppealText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

const AppealSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  password: z.string().min(6).max(128),
  message: z
    .string()
    .transform(normalizeAppealText)
    .refine((value) => Array.from(value).length >= 10, '異議申立ての理由を10文字以上で入力してください。')
    .refine((value) => Array.from(value).length <= 1000, '異議申立ては1000文字以内です。'),
});

export type SanctionAppealSubmitState =
  | {
      ok?: boolean;
      message?: string;
      status?: 'PENDING' | 'UPHELD' | 'OVERTURNED';
      resolutionNote?: string | null;
      sanctionType?: 'POST_RESTRICTION' | 'SUSPENSION';
      endsAt?: string | null;
      errors?: { email?: string[]; password?: string[]; message?: string[] };
    }
  | undefined;

function appealState(
  status: AppealStatus,
  resolutionNote: string | null,
  sanctionType: SanctionType,
  endsAt: Date | null,
): SanctionAppealSubmitState {
  return {
    ok: true,
    message:
      status === AppealStatus.PENDING
        ? '異議申立ては審査中です。'
        : status === AppealStatus.UPHELD
          ? '異議申立ての審査が完了し、処分は維持されました。'
          : '異議申立ての審査が完了し、処分は取り消されました。',
    status,
    resolutionNote,
    sanctionType:
      sanctionType === SanctionType.SUSPENSION
        ? 'SUSPENSION'
        : 'POST_RESTRICTION',
    endsAt: endsAt?.toISOString() ?? null,
  };
}

export async function submitSanctionAppeal(
  _prevState: SanctionAppealSubmitState,
  formData: FormData,
): Promise<SanctionAppealSubmitState> {
  const parsed = AppealSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    message: formData.get('message'),
  });
  if (!parsed.success) {
    return {
      message: '入力内容を確認してください。',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email;
  if (!(await rateLimit(`sanction-appeal-auth:${email}`, 10, 15 * 60 * 1000))) {
    return { message: '試行回数が多すぎます。時間をおいて再度お試しください。' };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      password: true,
      emailVerifiedAt: true,
    },
  });

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user?.password ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordMatches || !user.emailVerifiedAt) {
    return { message: 'メールアドレスまたはパスワードを確認してください。' };
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sanction = await tx.sanction.findFirst({
          where: {
            targetUserId: user.id,
            type: {
              in: [SanctionType.POST_RESTRICTION, SanctionType.SUSPENSION],
            },
            status: SanctionStatus.ACTIVE,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            type: true,
            endsAt: true,
            appeal: {
              select: {
                status: true,
                resolutionNote: true,
              },
            },
          },
        });

        if (!sanction) {
          const existing = await tx.appeal.findFirst({
            where: { userId: user.id },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
              status: true,
              resolutionNote: true,
              sanction: {
                select: {
                  type: true,
                  endsAt: true,
                },
              },
            },
          });
          if (existing) {
            return {
              kind: 'existing' as const,
              status: existing.status,
              resolutionNote: existing.resolutionNote,
              type: existing.sanction.type,
              endsAt: existing.sanction.endsAt,
            };
          }
          return { kind: 'none' as const };
        }

        if (sanction.appeal) {
          return {
            kind: 'existing' as const,
            status: sanction.appeal.status,
            resolutionNote: sanction.appeal.resolutionNote,
            type: sanction.type,
            endsAt: sanction.endsAt,
          };
        }

        const appeal = await tx.appeal.create({
          data: {
            sanctionId: sanction.id,
            userId: user.id,
            message: parsed.data.message,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            action: 'SANCTION_APPEAL_SUBMITTED',
            actorUserId: user.id,
            targetUserId: user.id,
            meta: {
              appealId: appeal.id,
              sanctionId: sanction.id,
              sanctionType: sanction.type,
            },
          },
        });

        return {
          kind: 'created' as const,
          status: AppealStatus.PENDING,
          resolutionNote: null,
          type: sanction.type,
          endsAt: sanction.endsAt,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind === 'none') {
      return {
        message: '現在、異議申立て対象となる有効な投稿制限またはアカウント停止はありません。',
      };
    }

    return appealState(
      result.status,
      result.resolutionNote,
      result.type,
      result.endsAt,
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      return {
        message: '処分または異議申立ての状態が変更されました。もう一度お試しください。',
      };
    }
    throw error;
  }
}
