import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { Role } from '@prisma/client';
import { isSuspensionActive } from '@/lib/accountStatus';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id || id.length > 128) {
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
            deletedAt: true,
            author: {
                select: { id: true, name: true, handle: true, avatarUrl: true, isPrivate: true, status: true, suspendedUntil: true },
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
    if (post.deletedAt) {
        return NextResponse.json({ post: null }, { status: 404 });
    }

    if ((post.isHidden || isSuspensionActive(post.author.status, post.author.suspendedUntil)) && !isModerator) {
        return NextResponse.json({ post: null }, { status: 404 });
    }

    if (viewerId) {
        const [blocked, muted] = await Promise.all([
            prisma.block.findFirst({
                where: {
                    OR: [
                        { blockerId: viewerId, blockedId: post.authorId },
                        { blockerId: post.authorId, blockedId: viewerId },
                    ],
                },
                select: { id: true },
            }),
            prisma.mute.findFirst({
                where: { muterId: viewerId, mutedId: post.authorId },
                select: { id: true },
            }),
        ]);
        if (blocked || muted) {
            return NextResponse.json({ post: null }, { status: 404 });
        }
        if (post.author.isPrivate && viewerId !== post.authorId) {
            const isFollowing = await prisma.follow.findFirst({
                where: {
                    followerId: viewerId,
                    followingId: post.authorId,
                    acceptedAt: { not: null },
                },
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
                handle: post.author.handle,
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
