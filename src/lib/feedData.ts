import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { clampPage } from '@/lib/pagination';
import { jstDateKey, stableShuffle } from '@/lib/stableShuffle';

export const FEED_PAGE_SIZE = 30;

export type FeedTab = 'for-you' | 'following';

export async function getFeedData({
    userId,
    tab,
    requestedPage = 1,
}: {
    userId: string | null;
    tab: FeedTab;
    requestedPage?: number;
}) {
    const now = new Date();

    const viewerProfilePromise = userId
        ? prisma.user.findUnique({
              where: { id: userId },
              select: { avatarUrl: true },
          })
        : Promise.resolve(null);

    const blockedIdsPromise = userId
        ? prisma.block
              .findMany({
                  where: { blockerId: userId },
                  select: { blockedId: true },
              })
              .then((rows) => rows.map((block) => block.blockedId))
        : Promise.resolve<string[]>([]);

    const mutedIdsPromise = userId
        ? prisma.mute
              .findMany({
                  where: { muterId: userId },
                  select: { mutedId: true },
              })
              .then((rows) => rows.map((mute) => mute.mutedId))
        : Promise.resolve<string[]>([]);

    const blockedByIdsPromise = userId
        ? prisma.block
              .findMany({
                  where: { blockedId: userId },
                  select: { blockerId: true },
              })
              .then((rows) => rows.map((block) => block.blockerId))
        : Promise.resolve<string[]>([]);

    const followingIdsPromise =
        userId && tab === 'following'
            ? prisma.follow
                  .findMany({
                      where: {
                          followerId: userId,
                          acceptedAt: { not: null },
                          following: visibleAccountFilter(now),
                      },
                      select: { followingId: true },
                  })
                  .then((rows) => rows.map((follow) => follow.followingId))
            : Promise.resolve<string[]>([]);

    const [viewerProfile, blockedIds, mutedIds, blockedByIds, followingIds] =
        await Promise.all([
            viewerProfilePromise,
            blockedIdsPromise,
            mutedIdsPromise,
            blockedByIdsPromise,
            followingIdsPromise,
        ]);

    const excludedAuthorIds = userId
        ? Array.from(new Set([...blockedIds, ...mutedIds, ...blockedByIds]))
        : [];

    const commonInclude = {
        author: {
            select: {
                id: true,
                name: true,
                handle: true,
                avatarUrl: true,
                isPrivate: true,
            },
        },
        likes: userId
            ? { where: { userId }, select: { id: true } }
            : { take: 0 },
        bookmarks: userId
            ? { where: { userId }, select: { id: true } }
            : { take: 0 },
        reactions: userId
            ? { where: { userId }, select: { type: true } }
            : { take: 0 },
        _count: { select: { likes: true } },
    } satisfies Prisma.PostInclude;

    let totalCount = 0;
    let page = 1;
    let totalPages = 1;
    let hasPrevious = false;
    let hasNext = false;
    let posts;

    if (tab === 'following') {
        if (followingIds.length === 0) {
            posts = [];
        } else {
            const followingWhere: Prisma.PostWhereInput = {
                isHidden: false,
                deletedAt: null,
                authorId: {
                    in: followingIds,
                    ...(excludedAuthorIds.length > 0
                        ? { notIn: excludedAuthorIds }
                        : {}),
                },
                author: visibleAccountFilter(now),
            };

            totalCount = await prisma.post.count({ where: followingWhere });
            const pagination = clampPage(
                requestedPage,
                totalCount,
                FEED_PAGE_SIZE,
            );
            page = pagination.page;
            totalPages = pagination.totalPages;
            hasPrevious = pagination.hasPrevious;
            hasNext = pagination.hasNext;

            posts = await prisma.post.findMany({
                where: followingWhere,
                include: commonInclude,
                skip: pagination.skip,
                take: pagination.pageSize,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            });
        }
    } else {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        posts = await prisma.post.findMany({
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
                          AND: [
                              visibleAccountFilter(now),
                              { isPrivate: false },
                          ],
                      },
            },
            include: commonInclude,
            take: FEED_PAGE_SIZE,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });

        posts = stableShuffle(
            posts,
            `${jstDateKey(now)}:${userId ?? 'guest'}:for-you`,
        );
        totalCount = posts.length;
    }

    return {
        viewerId: userId,
        viewerAvatarUrl: viewerProfile?.avatarUrl ?? null,
        totalCount,
        page,
        totalPages,
        hasPrevious,
        hasNext,
        posts: posts.map((post) => {
            const types = new Set(
                post.reactions.map((reaction) => reaction.type),
            );
            return {
                id: post.id,
                content: post.content,
                createdAt: post.createdAt.toISOString(),
                wakaruCount: post.wakaruCount,
                ganbattaCount: post.ganbattaCount,
                likeCount: post._count.likes,
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
    };
}
