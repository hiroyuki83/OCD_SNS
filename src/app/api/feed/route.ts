import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { privateJson } from '@/lib/apiResponse';
import type { Prisma } from '@prisma/client';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
    const requestedPage = parsePageNumber(searchParams.get('page'));
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    const now = new Date();

    const [viewerProfile, followingIds, blockedIds, mutedIds, blockedByIds] = userId
        ? await Promise.all([
              prisma.user.findUnique({
                  where: { id: userId },
                  select: { avatarUrl: true },
              }),
              prisma.follow
                  .findMany({
                      where: {
                          followerId: userId,
                          acceptedAt: { not: null },
                          following: visibleAccountFilter(now),
                      },
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

    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const followingWhere: Prisma.PostWhereInput = {
        isHidden: false,
        deletedAt: null,
        authorId: {
            in: followingIds,
            ...(excludedAuthorIds.length > 0 ? { notIn: excludedAuthorIds } : {}),
        },
        author: visibleAccountFilter(now),
    };

    const followingTotalCount =
        tab === 'following' && followingIds.length > 0
            ? await prisma.post.count({ where: followingWhere })
            : 0;
    const followingPagination = clampPage(requestedPage, followingTotalCount, 50);

    const posts =
        tab === 'following'
            ? followingIds.length > 0
                ? await prisma.post.findMany({
                      where: followingWhere,
                      include: {
                          author: {
                              select: { id: true, name: true, handle: true, avatarUrl: true, isPrivate: true },
                          },
                          likes: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                          bookmarks: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                          reactions: userId ? { where: { userId }, select: { type: true } } : { take: 0 },
                          _count: { select: { likes: true, bookmarks: true } },
                      },
                      skip: followingPagination.skip,
                      take: followingPagination.pageSize,
                      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                  })
                : []
            : await prisma.post.findMany({
                  where: {
                      isHidden: false,
                      deletedAt: null,
                      createdAt: { gte: weekAgo },
                      ...(userId && excludedAuthorIds.length > 0
                          ? { authorId: { notIn: excludedAuthorIds } }
                          : {}),
                      author: userId
                          ? {
                                AND: [
                                    visibleAccountFilter(now),
                                    {
                                        OR: [
                                            { isPrivate: false },
                                            { id: userId },
                                            {
                                                followers: {
                                                    some: {
                                                        followerId: userId,
                                                        acceptedAt: { not: null },
                                                    },
                                                },
                                            },
                                        ],
                                    },
                                ],
                            }
                          : {
                                AND: [visibleAccountFilter(now), { isPrivate: false }],
                            },
                  },
                  include: {
                      author: {
                          select: { id: true, name: true, handle: true, avatarUrl: true, isPrivate: true },
                      },
                      likes: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                      bookmarks: userId ? { where: { userId }, select: { id: true } } : { take: 0 },
                      reactions: userId ? { where: { userId }, select: { type: true } } : { take: 0 },
                      _count: { select: { likes: true, bookmarks: true } },
                  },
                  take: 100,
                  orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              });

    const shuffled =
        tab === 'for-you'
            ? (() => {
                  const copy = [...posts];
                  for (let i = copy.length - 1; i > 0; i -= 1) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [copy[i], copy[j]] = [copy[j], copy[i]];
                  }
                  return copy;
              })()
            : posts;

    return privateJson({
        viewerId: userId,
        viewerAvatarUrl: viewerProfile?.avatarUrl ?? null,
        totalCount: tab === 'following' ? followingTotalCount : shuffled.length,
        page: tab === 'following' ? followingPagination.page : 1,
        totalPages: tab === 'following' ? followingPagination.totalPages : 1,
        hasPrevious: tab === 'following' ? followingPagination.hasPrevious : false,
        hasNext: tab === 'following' ? followingPagination.hasNext : false,
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
                    handle: post.author.handle,
                    avatarUrl: post.author.avatarUrl,
                },
            };
        }),
    });
}
