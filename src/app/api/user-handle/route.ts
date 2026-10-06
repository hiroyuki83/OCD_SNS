import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isSuspensionActive, visibleAccountFilter } from '@/lib/accountStatus';
import { privateJson } from '@/lib/apiResponse';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawHandle = searchParams.get('handle')?.trim() ?? '';
    const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle;
    const requestedPage = parsePageNumber(searchParams.get('page'));
    if (!handle || handle.length > 64) {
        return privateJson({ user: null }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
        return privateJson({ user: null }, { status: 401 });
    }
    let viewerId = session.user.id ?? null;
    if (!viewerId && session?.user?.email) {
        const viewer = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = viewer?.id ?? null;
    }

    const user = await prisma.user.findUnique({
        where: { handle },
        select: { id: true, name: true, handle: true, bio: true, avatarUrl: true, headerUrl: true, isPrivate: true, status: true, suspendedUntil: true },
    });
    if (!user || isSuspensionActive(user.status, user.suspendedUntil)) {
        return privateJson({ user: null }, { status: 404 });
    }

    const now = new Date();

    const isSelf = viewerId === user.id;
    const [
        followerCount,
        followingCount,
        followRelation,
        blockedRow,
        mutedRow,
        blockedByRow,
    ] = await Promise.all([
        isSelf
            ? prisma.follow.count({
                  where: {
                      followingId: user.id,
                      acceptedAt: { not: null },
                      follower: visibleAccountFilter(now),
                  },
              })
            : Promise.resolve(null),
        isSelf
            ? prisma.follow.count({
                  where: {
                      followerId: user.id,
                      acceptedAt: { not: null },
                      following: visibleAccountFilter(now),
                  },
              })
            : Promise.resolve(null),
        viewerId
            ? prisma.follow.findUnique({
                  where: {
                      followerId_followingId: {
                          followerId: viewerId,
                          followingId: user.id,
                      },
                  },
                  select: { id: true, acceptedAt: true },
              })
            : Promise.resolve(null),
        viewerId
            ? prisma.block.findUnique({
                  where: {
                      blockerId_blockedId: {
                          blockerId: viewerId,
                          blockedId: user.id,
                      },
                  },
                  select: { id: true },
              })
            : Promise.resolve(null),
        viewerId
            ? prisma.mute.findUnique({
                  where: {
                      muterId_mutedId: {
                          muterId: viewerId,
                          mutedId: user.id,
                      },
                  },
                  select: { id: true },
              })
            : Promise.resolve(null),
        viewerId
            ? prisma.block.findUnique({
                  where: {
                      blockerId_blockedId: {
                          blockerId: user.id,
                          blockedId: viewerId,
                      },
                  },
                  select: { id: true },
              })
            : Promise.resolve(null),
    ]);
    const isBlocked = Boolean(blockedRow);
    const isMuted = Boolean(mutedRow);
    const isBlockedBy = Boolean(blockedByRow);
    const isBlockRestricted = isBlocked || isBlockedBy;

    const isFollowing = Boolean(followRelation?.acceptedAt);
    const isFollowPending = Boolean(followRelation && !followRelation.acceptedAt);
    const canViewPosts =
        !user.isPrivate || viewerId === user.id || isFollowing;
    const postAuthorVisibility: Prisma.UserWhereInput = viewerId
        ? {
              AND: [
                  visibleAccountFilter(now),
                  {
                      blocksInitiated: {
                          none: { blockedId: viewerId },
                      },
                  },
                  {
                      blockedBy: {
                          none: { blockerId: viewerId },
                      },
                  },
                  {
                      mutedBy: {
                          none: { muterId: viewerId },
                      },
                  },
                  {
                      OR: [
                          { isPrivate: false },
                          { id: viewerId },
                          {
                              followers: {
                                  some: {
                                      followerId: viewerId,
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
          };

    const canReadPosts =
        canViewPosts && !isBlocked && !isMuted && !isBlockedBy;

    const postWhere: Prisma.PostWhereInput = {
        authorId: user.id,
        isHidden: false,
        deletedAt: null,
        author: postAuthorVisibility,
    };

    const postCount = canReadPosts
        ? await prisma.post.count({ where: postWhere })
        : 0;
    const postPagination = clampPage(requestedPage, postCount, 50);

    const posts =
        !canReadPosts
        ? []
        : await prisma.post.findMany({
              where: postWhere,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              skip: postPagination.skip,
              take: postPagination.pageSize,
              select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  wakaruCount: true,
                  ganbattaCount: true,
                  likes: viewerId ? { where: { userId: viewerId }, select: { id: true } } : { take: 0 },
                  bookmarks: viewerId ? { where: { userId: viewerId }, select: { id: true } } : { take: 0 },
                  reactions: viewerId
                      ? { where: { userId: viewerId }, select: { type: true } }
                      : { take: 0 },
                  _count: {
                      select: {
                          likes: true,
                          bookmarks: true,
                      },
                  },
              },
          });

    return privateJson({
        user: {
            id: user.id,
            name: user.name,
            handle: user.handle,
            bio: isBlockRestricted ? null : user.bio,
            avatarUrl: user.avatarUrl,
            headerUrl: isBlockRestricted ? null : user.headerUrl,
            isPrivate: user.isPrivate,
            ...(isSelf && !isBlockRestricted
                ? {
                      followerCount: followerCount ?? 0,
                      followingCount: followingCount ?? 0,
                  }
                : {}),
        },
        viewerId,
        isFollowing,
        isFollowPending,
        isBlocked,
        isMuted,
        isBlockedBy,
        postCount,
        page: postPagination.page,
        totalPages: postPagination.totalPages,
        hasPrevious: postPagination.hasPrevious,
        hasNext: postPagination.hasNext,
        posts: canReadPosts
            ? posts.map((post) => {
                const types = new Set(post.reactions.map((reaction) => reaction.type));
                return {
                    id: post.id,
                    content: post.content,
                    createdAt: post.createdAt,
                    wakaruCount: post.wakaruCount,
                    ganbattaCount: post.ganbattaCount,
                    likeCount: post._count.likes,
                    bookmarkCount: post._count.bookmarks,
                    liked: post.likes.length > 0,
                    bookmarked: post.bookmarks.length > 0,
                    wakaruReacted: types.has('WAKARU'),
                    ganbattaReacted: types.has('GANBATTA'),
                };
        })
            : [],
    });
}
