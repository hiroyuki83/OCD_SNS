import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isSuspensionActive, visibleAccountFilter } from '@/lib/accountStatus';
import { privateJson } from '@/lib/apiResponse';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const requestedPage = parsePageNumber(searchParams.get('page'));
    if (!id || id.length > 128) {
        return privateJson({ user: null }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            handle: true,
            bio: true,
            avatarUrl: true,
            headerUrl: true,
            isPrivate: true,
            status: true,
            suspendedUntil: true,
        },
    });
    if (!user || isSuspensionActive(user.status, user.suspendedUntil)) {
        return privateJson({ user: null }, { status: 404 });
    }

    const session = await auth();
    let viewerId = session?.user?.id ?? null;
    if (!viewerId && session?.user?.email) {
        const viewer = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = viewer?.id ?? null;
    }

    let canViewPosts = true;
    let isBlockRestricted = false;
    if (viewerId) {
        const [blocked, muted] = await Promise.all([
            prisma.block.findFirst({
                where: {
                    OR: [
                        { blockerId: viewerId, blockedId: user.id },
                        { blockerId: user.id, blockedId: viewerId },
                    ],
                },
                select: { id: true },
            }),
            prisma.mute.findFirst({
                where: { muterId: viewerId, mutedId: user.id },
                select: { id: true },
            }),
        ]);
        isBlockRestricted = Boolean(blocked);
        if (blocked || muted) canViewPosts = false;
    }
    if (user.isPrivate && viewerId !== user.id) {
        const isFollowing = viewerId
            ? await prisma.follow.findFirst({
                  where: {
                      followerId: viewerId,
                      followingId: user.id,
                      acceptedAt: { not: null },
                  },
                  select: { id: true },
              })
            : null;
        if (!isFollowing) canViewPosts = false;
    }

    const now = new Date();
    const postWhere = {
        authorId: user.id,
        isHidden: false,
        deletedAt: null,
    };
    const [postCount, followerCount, followingCount] = await Promise.all([
        canViewPosts ? prisma.post.count({ where: postWhere }) : Promise.resolve(0),
        prisma.follow.count({
            where: {
                followingId: user.id,
                acceptedAt: { not: null },
                follower: visibleAccountFilter(now),
            },
        }),
        prisma.follow.count({
            where: {
                followerId: user.id,
                acceptedAt: { not: null },
                following: visibleAccountFilter(now),
            },
        }),
    ]);
    const postPagination = clampPage(requestedPage, postCount, 50);
    const posts = canViewPosts
        ? await prisma.post.findMany({
              where: postWhere,
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              skip: postPagination.skip,
              take: postPagination.pageSize,
              select: { id: true, content: true, imageUrl: true, createdAt: true },
          })
        : [];

    return privateJson({
        user: {
            id: user.id,
            name: user.name,
            handle: user.handle,
            bio: isBlockRestricted ? null : user.bio,
            avatarUrl: user.avatarUrl,
            headerUrl: isBlockRestricted ? null : user.headerUrl,
            isPrivate: user.isPrivate,
            followerCount: isBlockRestricted ? 0 : followerCount,
            followingCount: isBlockRestricted ? 0 : followingCount,
            canViewPosts,
            postCount,
            postPage: postPagination.page,
            postTotalPages: postPagination.totalPages,
            postHasPrevious: postPagination.hasPrevious,
            postHasNext: postPagination.hasNext,
            posts,
        },
    });
}
