import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { publicHandleFromEmail } from '@/lib/publicUser';
import { AccountStatus } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawHandle = searchParams.get('handle')?.trim() ?? '';
    const handle = rawHandle.startsWith('@') ? rawHandle.slice(1) : rawHandle;
    if (!handle) {
        return NextResponse.json({ user: null }, { status: 400 });
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

    const user = await prisma.user.findFirst({
        where: { email: { startsWith: `${handle}@` } },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, headerUrl: true, isPrivate: true, status: true },
    });
    if (!user) {
        return NextResponse.json({ user: null }, { status: 404 });
    }

    const [isFollowing, isBlocked, isMuted, isBlockedBy] = viewerId
        ? await Promise.all([
              prisma.follow
                  .findFirst({
                      where: { followerId: viewerId, followingId: user.id },
                      select: { id: true },
                  })
                  .then((result) => !!result),
              prisma.block
                  .findFirst({
                      where: { blockerId: viewerId, blockedId: user.id },
                      select: { id: true },
                  })
                  .then((result) => !!result),
              prisma.mute
                  .findFirst({
                      where: { muterId: viewerId, mutedId: user.id },
                      select: { id: true },
                  })
                  .then((result) => !!result),
              prisma.block
                  .findFirst({
                      where: { blockerId: user.id, blockedId: viewerId },
                      select: { id: true },
                  })
                  .then((result) => !!result),
          ])
        : [false, false, false, false];

    const posts = isBlocked || isMuted || isBlockedBy || user.status === AccountStatus.SUSPENDED
        ? []
        : await prisma.post.findMany({
              where: { authorId: user.id, isHidden: false, deletedAt: null },
              orderBy: { createdAt: 'desc' },
              select: {
                  id: true,
                  content: true,
                  imageUrl: true,
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

    const canViewPosts = !user.isPrivate || viewerId === user.id || isFollowing;

    return NextResponse.json({
        user: {
            ...user,
            email: publicHandleFromEmail(user.email),
        },
        viewerId,
        isFollowing,
        isBlocked,
        isMuted,
        isBlockedBy,
        posts: canViewPosts
            ? posts.map((post) => {
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
                };
        })
            : [],
    });
}
