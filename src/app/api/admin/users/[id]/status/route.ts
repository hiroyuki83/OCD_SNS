import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { AccountStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/rbac";

const BodySchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.POST_RESTRICTED, AccountStatus.SUSPENDED]),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await requireRoleApi(Role.ADMIN);
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "status が不正です。" }, { status: 400 });
  }

  const nextStatus = parsed.data.status;
  const reason = parsed.data.reason || null;

  const result = await prisma.$transaction(async (tx) => {
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

    await tx.user.update({
      where: { id: target.id },
      data: {
        status: nextStatus,
        suspendedUntil,
        restrictionReason: nextStatus === AccountStatus.ACTIVE ? null : reason,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "USER_STATUS_CHANGE",
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: { fromStatus: target.status, toStatus: nextStatus, suspendedUntil, reason },
      },
    });

    return { ok: true } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
