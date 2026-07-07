import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { AccountStatus, ReportReason, ReportStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

const reportReasons = [
  ReportReason.HARASSMENT,
  ReportReason.SPAM,
  ReportReason.IMPERSONATION,
  ReportReason.SELF_HARM,
  ReportReason.OTHER,
] as const;

const BodySchema = z.object({
  postId: z.string().trim().min(1).optional(),
  targetUserId: z.string().trim().min(1).optional(),
  reason: z.enum(reportReasons).default(ReportReason.OTHER),
  detail: z.string().trim().max(500).optional(),
});

async function resolveViewerId() {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (userId) return userId;
  const email = session?.user?.email ?? null;
  if (!email) return null;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  const reporterId = await resolveViewerId();
  if (!reporterId) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  if (!rateLimit(`report:${reporterId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "通報が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "通報内容が不正です。" }, { status: 400 });
  }

  const { postId, reason } = parsed.data;
  const detail = parsed.data.detail || null;
  let targetUserId = parsed.data.targetUserId ?? null;

  if (!postId && !targetUserId) {
    return NextResponse.json({ error: "通報対象が指定されていません。" }, { status: 400 });
  }

  if (postId) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        deletedAt: true,
        isHidden: true,
        author: { select: { status: true } },
      },
    });
    if (!post || post.deletedAt || post.isHidden || post.author.status === AccountStatus.SUSPENDED) {
      return NextResponse.json({ error: "投稿が見つかりません。" }, { status: 404 });
    }
    targetUserId = post.authorId;
  } else if (targetUserId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "ユーザーが見つかりません。" }, { status: 404 });
    }
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "通報対象が指定されていません。" }, { status: 400 });
  }

  if (targetUserId === reporterId) {
    return NextResponse.json({ error: "自分自身は通報できません。" }, { status: 400 });
  }

  const existing = await prisma.report.findFirst({
    where: {
      reporterId,
      status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
      ...(postId ? { postId } : { targetUserId, postId: null }),
    },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.report.create({
    data: {
      reporterId,
      targetUserId,
      postId: postId ?? null,
      reason,
      detail,
    },
  });

  return NextResponse.json({ ok: true });
}
