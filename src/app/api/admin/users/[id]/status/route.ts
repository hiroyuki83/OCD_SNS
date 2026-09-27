import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { AccountStatus, Prisma, Role, SanctionStatus, SanctionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRoleApi } from "@/lib/rbac";
import { rateLimit } from "@/lib/rateLimit";
import { parseJsonMutationRequest } from "@/lib/requestSecurity";

const BodySchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.POST_RESTRICTED, AccountStatus.SUSPENDED]),
  reason: z.string().trim().max(500).optional(),
  currentPassword: z.string().min(1).max(128),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: parsedRequest.status });
  }

  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!id || id.length > 128) {
    return NextResponse.json({ error: "ユーザーIDが不正です。" }, { status: 400 });
  }
  const authz = await checkRoleApi(Role.ADMIN);
  if ("error" in authz) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const actor = authz.user;
  if (!(await rateLimit(`admin-mutation:${actor.id}`, 30, 60 * 1000))) {
    return NextResponse.json({ error: "操作が多すぎます。" }, { status: 429 });
  }

  const body = parsedRequest.data;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "status が不正です。" }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  const reason = parsed.data.reason?.trim() || null;

  if (nextStatus !== AccountStatus.ACTIVE && (!reason || reason.length < 5)) {
    return NextResponse.json({ error: "制限・停止理由は5文字以上で入力してください。" }, { status: 400 });
  }

  const actorAccount = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { password: true },
  });
  if (!actorAccount || !(await bcrypt.compare(parsed.data.currentPassword, actorAccount.password))) {
    return NextResponse.json(
      { error: "現在のADMINパスワードを確認できませんでした。" },
      { status: 403 },
    );
  }

  const result = await (async () => {
    try {
      return await prisma.$transaction(async (tx) => {
    const currentActor = await tx.user.findUnique({
      where: { id: actor.id },
      select: { role: true },
    });
    if (!currentActor || currentActor.role !== Role.ADMIN) {
      return { error: "権限が変更されました。画面を更新してください。", status: 403 } as const;
    }

    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });

    if (!target) return { error: "ユーザーが見つかりません。", status: 404 } as const;
    if (target.role === Role.ADMIN && nextStatus !== AccountStatus.ACTIVE) {
      return { error: "ADMINアカウントは停止・制限できません。", status: 400 } as const;
    }
    if (target.status === nextStatus) {
      return { ok: true } as const;
    }

    const suspendedUntil =
      nextStatus === AccountStatus.SUSPENDED
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : null;
    const restrictionUntil =
      nextStatus === AccountStatus.POST_RESTRICTED
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

    const updated = await tx.user.updateMany({
      where: {
        id: target.id,
        status: target.status,
        ...(nextStatus !== AccountStatus.ACTIVE ? { role: { not: Role.ADMIN } } : {}),
      },
      data: {
        status: nextStatus,
        suspendedUntil,
        restrictionUntil,
        restrictionReason: nextStatus === AccountStatus.ACTIVE ? null : reason,
        ...(nextStatus === AccountStatus.SUSPENDED
          ? { sessionVersion: { increment: 1 } }
          : {}),
      },
    });
    if (updated.count !== 1) {
      return { error: "対象ユーザーの状態または権限が変更されました。画面を更新してください。", status: 409 } as const;
    }

    const sanctionChangedAt = new Date();
    await tx.sanction.updateMany({
      where: {
        targetUserId: target.id,
        status: SanctionStatus.ACTIVE,
        endsAt: { lte: sanctionChangedAt },
      },
      data: { status: SanctionStatus.EXPIRED },
    });

    await tx.sanction.updateMany({
      where: {
        targetUserId: target.id,
        status: SanctionStatus.ACTIVE,
      },
      data: {
        status: SanctionStatus.REVOKED,
        revokedAt: sanctionChangedAt,
      },
    });

    let sanctionId: string | null = null;
    if (nextStatus !== AccountStatus.ACTIVE) {
      const sanction = await tx.sanction.create({
        data: {
          type:
            nextStatus === AccountStatus.POST_RESTRICTED
              ? SanctionType.POST_RESTRICTION
              : SanctionType.SUSPENSION,
          status: SanctionStatus.ACTIVE,
          reason: reason ?? "ADMINによるアカウント状態変更",
          startsAt: sanctionChangedAt,
          endsAt:
            nextStatus === AccountStatus.POST_RESTRICTED
              ? restrictionUntil
              : suspendedUntil,
          targetUserId: target.id,
          actorUserId: actor.id,
        },
        select: { id: true },
      });
      sanctionId = sanction.id;
    }

    await tx.auditLog.create({
      data: {
        action: "USER_STATUS_CHANGE",
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: {
          sanctionId,
          fromStatus: target.status,
          toStatus: nextStatus,
          suspendedUntil,
          restrictionUntil,
          reason,
          sessionsRevoked: nextStatus === AccountStatus.SUSPENDED,
        },
      },
    });

    return { ok: true } as const;
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        return { error: "同時にアカウント状態が変更されました。画面を更新して再度お試しください。", status: 409 } as const;
      }
      throw error;
    }
  })();

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
