import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { AccountStatus, type Prisma } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    if (!rawQuery) {
        return NextResponse.json({ posts: [] });
    }
    const query = rawQuery.slice(0, 100);
    const insensitive: Prisma.QueryMode = 'insensitive';

    const session = await auth();
    let viewerId = session?.user?.id ?? null;
    if (!viewerId && session?.user?.email) {
        const viewer = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        viewerId = viewer?.id ?? null;
    }

    const blockedIds = viewerId
        ? (
              await prisma.block.findMany({
                  where: { blockerId: viewerId },
                  select: { blockedId: true },
              })
          ).map((row) => row.blockedId)
        : [];

    const blockedByIds = viewerId
        ? (
              await prisma.block.findMany({
                  where: { blockedId: viewerId },
                  select: { blockerId: true },
              })
          ).map((row) => row.blockerId)
        : [];

    const mutedIds = viewerId
        ? (
              await prisma.mute.findMany({
                  where: { muterId: viewerId },
                  select: { mutedId: true },
              })
          ).map((row) => row.mutedId)
        : [];

    const excludedAuthorIds = viewerId
        ? Array.from(new Set([...blockedIds, ...blockedByIds, ...mutedIds]))
        : [];

    const followingIds = viewerId
        ? (
              await prisma.follow.findMany({
                  where: {
                      followerId: viewerId,
                      acceptedAt: { not: null },
                  },
                  select: { followingId: true },
              })
          ).map((row) => row.followingId)
        : [];

    const posts = await prisma.post.findMany({
        where: {
            isHidden: false,
            deletedAt: null,
            content: { contains: query, mode: insensitive },
            ...(excludedAuthorIds.length > 0 ? { authorId: { notIn: excludedAuthorIds } } : {}),
            author: { status: { not: AccountStatus.SUSPENDED } },
        },
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { id: true, name: true, handle: true, isPrivate: true },
            },
        },
        take: 20,
    });

    const filtered = posts.filter((post) => {
        if (!post.author.isPrivate) return true;
        if (!viewerId) return false;
        return followingIds.includes(post.author.id);
    });

    return NextResponse.json({
        posts: filtered.map((post) => ({
            id: post.id,
            content: post.content,
            imageUrl: post.imageUrl,
            createdAt: post.createdAt,
            author: {
                name: post.author.name,
                handle: post.author.handle,
            },
        })),
    });
}
