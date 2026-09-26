import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { AccountStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRoleApi } from "@/lib/rbac";
import { rateLimit } from "@/lib/rateLimit";
import { validateJsonMutationRequest } from "@/lib/requestSecurity";

const BodySchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.POST_RESTRICTED, AccountStatus.SUSPENDED]),
  reason: z.string().trim().max(500).optional(),
  currentPassword: z.string().min(1).max(128),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestCheck = validateJsonMutationRequest(request);
  if (!requestCheck.ok) {
    return NextResponse.json({ error: requestCheck.error }, { status: requestCheck.status });
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

  const body = await request.json().catch(() => null);
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
    const restrictionUntil =
      nextStatus === AccountStatus.POST_RESTRICTED
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : null;

    await tx.user.update({
      where: { id: target.id },
      data: {
        status: nextStatus,
        suspendedUntil,
        restrictionUntil,
        restrictionReason: nextStatus === AccountStatus.ACTIVE ? null : reason,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "USER_STATUS_CHANGE",
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: {
          fromStatus: target.status,
          toStatus: nextStatus,
          suspendedUntil,
          restrictionUntil,
          reason,
        },
      },
    });

    return { ok: true } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
