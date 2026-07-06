import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { publicHandleFromEmail } from '@/lib/publicUser';
import { AccountStatus, Role } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id) {
        return NextResponse.json({ post: null }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
        where: { id },
        select: {
            id: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            authorId: true,
            isHidden: true,
            hiddenReason: true,
            author: {
                select: { id: true, name: true, email: true, avatarUrl: true, isPrivate: true, status: true },
            },
        },
    });
    if (!post) {
        return NextResponse.json({ post: null }, { status: 404 });
    }

    const session = await auth();
    let viewerId = session?.user?.id ?? null;
    let viewerRole: Role | null = (session?.user?.role as Role | undefined) ?? null;
    if (!viewerId && session?.user?.email) {
        const viewer = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, role: true },
        });
        viewerId = viewer?.id ?? null;
        viewerRole = viewer?.role ?? null;
    } else if (viewerId && !viewerRole) {
        const viewer = await prisma.user.findUnique({
            where: { id: viewerId },
            select: { role: true },
        });
        viewerRole = viewer?.role ?? null;
    }

    const isModerator = viewerRole === Role.ADMIN || viewerRole === Role.MODERATOR;
    if ((post.isHidden || post.author.status === AccountStatus.SUSPENDED) && !isModerator) {
        return NextResponse.json({ post: null }, { status: 404 });
    }

    if (viewerId) {
        const blocked = await prisma.block.findFirst({
            where: {
                OR: [
                    { blockerId: viewerId, blockedId: post.authorId },
                    { blockerId: post.authorId, blockedId: viewerId },
                ],
            },
            select: { id: true },
        });
        if (blocked) {
            return NextResponse.json({ post: null }, { status: 404 });
        }
        if (post.author.isPrivate && viewerId !== post.authorId) {
            const isFollowing = await prisma.follow.findFirst({
                where: { followerId: viewerId, followingId: post.authorId },
                select: { id: true },
            });
            if (!isFollowing) {
                return NextResponse.json({ post: null }, { status: 404 });
            }
        }
    } else {
        if (post.author.isPrivate) {
            return NextResponse.json({ post: null }, { status: 404 });
        }
    }

    return NextResponse.json({
        post: {
            id: post.id,
            content: post.content,
            imageUrl: post.imageUrl,
            createdAt: post.createdAt,
            author: {
                id: post.author.id,
                name: post.author.name,
                email: publicHandleFromEmail(post.author.email),
                avatarUrl: post.author.avatarUrl,
            },
            hidden: isModerator
                ? {
                      isHidden: post.isHidden,
                      reason: post.hiddenReason,
                  }
                : undefined,
        },
    });
}
