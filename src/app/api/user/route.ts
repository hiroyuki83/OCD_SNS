import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { isSuspensionActive, visibleAccountFilter } from '@/lib/accountStatus';
import { privateJson } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
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
    const [posts, followerCount, followingCount] = await Promise.all([
        canViewPosts
            ? prisma.post.findMany({
                  where: { authorId: user.id, isHidden: false, deletedAt: null },
                  orderBy: { createdAt: 'desc' },
                  take: 100,
                  select: { id: true, content: true, imageUrl: true, createdAt: true },
              })
            : Promise.resolve([]),
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
            posts,
        },
    });
}
