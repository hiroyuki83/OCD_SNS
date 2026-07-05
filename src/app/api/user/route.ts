import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { publicHandleFromEmail } from '@/lib/publicUser';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) {
        return NextResponse.json({ user: null }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true, headerUrl: true, isPrivate: true },
    });
    if (!user) {
        return NextResponse.json({ user: null }, { status: 404 });
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
    if (viewerId) {
        const blocked = await prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: viewerId, blockedId: user.id },
                    { blockerId: user.id, blockedId: viewerId },
                ],
            },
            select: { id: true },
        });
        if (blocked) canViewPosts = false;
    }
    if (user.isPrivate && viewerId !== user.id) {
        const isFollowing = viewerId
            ? await prisma.follow.findFirst({
                  where: { followerId: viewerId, followingId: user.id },
                  select: { id: true },
              })
            : null;
        if (!isFollowing) canViewPosts = false;
    }

    const posts = canViewPosts
        ? await prisma.post.findMany({
              where: { authorId: user.id },
              orderBy: { createdAt: 'desc' },
              select: { id: true, content: true, imageUrl: true, createdAt: true },
          })
        : [];

    return NextResponse.json({
        user: {
            ...user,
            email: publicHandleFromEmail(user.email),
            posts,
        },
    });
}
