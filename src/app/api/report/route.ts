import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma, ReportReason, ReportStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";
import { getAccessiblePostForViewer } from "@/lib/postAccess";
import { parseJsonMutationRequest } from "@/lib/requestSecurity";
import { normalizeReportDetail } from "@/lib/reportInput";

const reportReasons = [
  ReportReason.HARASSMENT,
  ReportReason.SPAM,
  ReportReason.IMPERSONATION,
  ReportReason.SELF_HARM,
  ReportReason.OTHER,
] as const;

const BodySchema = z.object({
  postId: z.string().trim().min(1).max(128).optional(),
  targetUserId: z.string().trim().min(1).max(128).optional(),
  reason: z.enum(reportReasons).default(ReportReason.OTHER),
  detail: z.unknown().optional(),
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
  const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: parsedRequest.status });
  }

  const reporterId = await resolveViewerId();
  if (!reporterId) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  if (!(await rateLimit(`report:${reporterId}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "通報が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 },
    );
  }

  const body = parsedRequest.data;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "通報内容が不正です。" }, { status: 400 });
  }

  const { postId, reason } = parsed.data;
  const detailResult = normalizeReportDetail(parsed.data.detail, reason);
  if (!detailResult.ok) {
    return NextResponse.json({ error: detailResult.error }, { status: 400 });
  }
  const detail = detailResult.value;
  let targetUserId = parsed.data.targetUserId ?? null;

  if (!postId && !targetUserId) {
    return NextResponse.json({ error: "通報対象が指定されていません。" }, { status: 400 });
  }
  if (postId && targetUserId) {
    return NextResponse.json({ error: "通報対象は投稿かユーザーのどちらか一方を指定してください。" }, { status: 400 });
  }

  if (postId) {
    const post = await getAccessiblePostForViewer(reporterId, postId);
    if (!post) {
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          if (postId) {
            const currentPost = await tx.post.findUnique({
              where: { id: postId },
              select: { authorId: true, deletedAt: true, isHidden: true },
            });
            if (
              !currentPost ||
              currentPost.deletedAt ||
              currentPost.isHidden ||
              currentPost.authorId !== targetUserId
            ) {
              return { kind: "not-found" as const };
            }
          }

          const existing = await tx.report.findFirst({
            where: {
              reporterId,
              status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] },
              ...(postId ? { postId } : { targetUserId, postId: null }),
            },
            select: { id: true },
          });

          if (existing) {
            return { kind: "duplicate" as const };
          }

          await tx.report.create({
            data: {
              reporterId,
              targetUserId,
              postId: postId ?? null,
              reason,
              detail,
            },
          });
          return { kind: "created" as const };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      if (result.kind === "not-found") {
        return NextResponse.json({ error: "通報対象が見つかりません。" }, { status: 404 });
      }
      if (result.kind === "duplicate") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (!retryable) throw error;
      if (attempt === 2) {
        return NextResponse.json(
          { error: "同時に通報処理が行われました。再度お試しください。" },
          { status: 409 },
        );
      }
    }
  }

  return NextResponse.json({ error: "通報に失敗しました。" }, { status: 409 });
}
