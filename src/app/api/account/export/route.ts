import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { accountExportHeaders } from '@/lib/accountExport';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'ログインしてください。' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  if (!(await rateLimit(`account-export:${userId}`, 3, 60 * 60 * 1000))) {
    return new Response(JSON.stringify({ error: 'エクスポート回数が多すぎます。しばらくしてから再度お試しください。' }), {
      status: 429,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const [
    user,
    posts,
    likes,
    bookmarks,
    reactions,
    following,
    followers,
    blocks,
    mutes,
    notifications,
    reportsMade,
    reportsTargetingUser,
    warnings,
    ybocsResults,
    iesrResults,
    itqResults,
    lsasResults,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        handle: true,
        emailVerifiedAt: true,
        name: true,
        bio: true,
        avatarUrl: true,
        headerUrl: true,
        autoHashtag: true,
        isPrivate: true,
        role: true,
        status: true,
        restrictionReason: true,
        restrictionUntil: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        content: true,
        imageUrl: true,
        imageAlt: true,
        createdAt: true,
        isHidden: true,
        hiddenAt: true,
        hiddenReason: true,
        deletedAt: true,
        wakaruCount: true,
        ganbattaCount: true,
      },
    }),
    prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, postId: true, createdAt: true },
    }),
    prisma.bookmark.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, postId: true, createdAt: true },
    }),
    prisma.reaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, postId: true, type: true, createdAt: true },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, followingId: true, createdAt: true, acceptedAt: true },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, followerId: true, createdAt: true, acceptedAt: true },
    }),
    prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, blockedId: true, createdAt: true },
    }),
    prisma.mute.findMany({
      where: { muterId: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, mutedId: true, createdAt: true },
    }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        actorId: true,
        postId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        reason: true,
        detail: true,
        status: true,
        priority: true,
        targetUserId: true,
        postId: true,
        reviewedAt: true,
        dueAt: true,
        resolutionNote: true,
      },
    }),
    prisma.report.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        reason: true,
        status: true,
        priority: true,
        postId: true,
        reviewedAt: true,
        dueAt: true,
        resolutionNote: true,
      },
    }),
    prisma.moderationWarning.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        createdAt: true,
        readAt: true,
        revokedAt: true,
        reason: true,
        reportId: true,
        appeal: {
          select: {
            id: true,
            createdAt: true,
            message: true,
            status: true,
            resolutionNote: true,
            reviewedAt: true,
          },
        },
      },
    }),
    prisma.ybocsResult.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.iesrResult.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.itqResult.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.lsasResult.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  if (!user) {
    return new Response(JSON.stringify({ error: 'アカウント情報を取得できませんでした。' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  const exportedAt = new Date();
  const payload = {
    format: 'coco-account-export-v1',
    exportedAt,
    account: user,
    posts,
    interactions: { likes, bookmarks, reactions },
    relationships: { following, followers, blocks, mutes },
    notifications,
    moderation: { reportsMade, reportsTargetingUser, warnings },
    selfTests: { ybocsResults, iesrResults, itqResults, lsasResults },
    exclusions: [
      'password hash',
      'staff TOTP secret',
      'staff recovery codes',
      'password-reset and email-verification tokens',
      'internal admin notes',
      'internal audit logs',
    ],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: accountExportHeaders(exportedAt),
  });
}
