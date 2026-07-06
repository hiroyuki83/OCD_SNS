import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checkRoleApi } from "@/lib/rbac";

const BodySchema = z.object({
  role: z.enum([Role.USER, Role.MODERATOR, Role.ADMIN]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const authz = await checkRoleApi(Role.ADMIN);
  if ("error" in authz) {
    return NextResponse.json({ error: authz.error }, { status: authz.status });
  }

  const actor = authz.user;
  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "role が不正です。" }, { status: 400 });
  }

  const nextRole = parsed.data.role;

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!target) return { error: "ユーザーが見つかりません。", status: 404 } as const;

    if (target.role === nextRole) {
      return { ok: true } as const;
    }

    if (target.role === Role.ADMIN && nextRole !== Role.ADMIN) {
      const adminCount = await tx.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        return { error: "最後のADMINは降格できません。", status: 400 } as const;
      }
    }

    await tx.user.update({
      where: { id: target.id },
      data: { role: nextRole },
    });

    await tx.auditLog.create({
      data: {
        action: "ROLE_CHANGE",
        actorUserId: actor.id,
        targetUserId: target.id,
        meta: { fromRole: target.role, toRole: nextRole },
      },
    });

    return { ok: true } as const;
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
