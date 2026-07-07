import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { publicHandleFromEmail } from '@/lib/publicUser';
import { AccountStatus } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    const [viewerProfile, followingIds, blockedIds, mutedIds, blockedByIds] = userId
        ? await Promise.all([
              prisma.user.findUnique({
                  where: { id: userId },
                  select: { avatarUrl: true },
              }),
              prisma.follow
                  .findMany({
                      where: { followerId: userId },
                      select: { followingId: true },
                  })
                  .then((rows) => rows.map((follow) => follow.followingId)),
              prisma.block
                  .findMany({
                      where: { blockerId: userId },
                      select: { blockedId: true },
                  })
                  .then((rows) => rows.map((block) => block.blockedId)),
              prisma.mute
                  .findMany({
                      where: { muterId: userId },
                      select: { mutedId: true },
                  })
                  .then((rows) => rows.map((mute) => mute.mutedId)),
              prisma.block
                  .findMany({
                      where: { blockedId: userId },
                      select: { blockerId: true },
                  })
                  .then((rows) => rows.map((block) => block.blockerId)),
          ])
        : [null, [], [], [], []];

    const excludedAuthorIds = userId
        ? Array.from(new Set([...blockedIds, ...mutedIds, ...blockedByIds]))
        : [];

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const posts =
        tab === 'following'
            ? followingIds.length > 0
                ? await prisma.post.findMany({
                      where: {
                          isHidden: false,
                          deletedAt: null,
                          authorId: {
                              in: followingIds,
                              ...(excludedAuthorIds.length > 0 ? { notIn: excludedAuthorIds } : {}),
                          },
                          author: { status: { not: AccountStatus.SUSPENDED } },
                      },
                  include: {
                          author: {
                              select: { id: true, name: true, email: true, avatarUrl: true, isPrivate: true },
                          },
                          likes: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                          bookmarks: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                          reactions: userId ? { where: { userId }, select: { type: true } } : { take: 0 },
                          _count: { select: { likes: true, bookmarks: true } },
                      },
                      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  })
                : []
            : await prisma.post.findMany({
                  where: {
                      isHidden: false,
                      deletedAt: null,
                      author: { status: { not: AccountStatus.SUSPENDED } },
                      createdAt: { gte: weekAgo },
                      ...(userId
                          ? {
                                authorId: {
                                    ...(excludedAuthorIds.length > 0 ? { notIn: excludedAuthorIds } : {}),
                                },
                            }
                          : {}),
                  },
                  include: {
                      author: {
                          select: { id: true, name: true, email: true, avatarUrl: true, isPrivate: true },
                      },
                      likes: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                      bookmarks: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                      reactions: userId ? { where: { userId }, select: { type: true } } : { take: 0 },
                      _count: { select: { likes: true, bookmarks: true } },
                  },
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              });

    const filtered =
        tab === 'for-you' && userId
            ? posts.filter((post) => !post.author.isPrivate || followingIds.includes(post.author.id))
            : posts.filter((post) => !post.author.isPrivate);

    const shuffled =
        tab === 'for-you'
            ? (() => {
                  const copy = [...filtered];
                  for (let i = copy.length - 1; i > 0; i -= 1) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [copy[i], copy[j]] = [copy[j], copy[i]];
                  }
                  return copy;
              })()
            : filtered;

    return NextResponse.json({
        viewerId: userId,
        viewerAvatarUrl: viewerProfile?.avatarUrl ?? null,
        followingIds,
        posts: shuffled.map((post) => {
            const types = new Set(post.reactions.map((reaction) => reaction.type));
            return {
                id: post.id,
                content: post.content,
                imageUrl: post.imageUrl,
                createdAt: post.createdAt,
                wakaruCount: post.wakaruCount,
                ganbattaCount: post.ganbattaCount,
                likeCount: post._count.likes,
                bookmarkCount: post._count.bookmarks,
                liked: post.likes.length > 0,
                bookmarked: post.bookmarks.length > 0,
                wakaruReacted: types.has('WAKARU'),
                ganbattaReacted: types.has('GANBATTA'),
                author: {
                    id: post.author.id,
                    name: post.author.name,
                    email: publicHandleFromEmail(post.author.email),
                    avatarUrl: post.author.avatarUrl,
                },
            };
        }),
    });
}
