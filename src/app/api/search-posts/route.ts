import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { publicHandleFromEmail } from '@/lib/publicUser';
import type { Prisma } from '@prisma/client';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() ?? '';
    if (!query) {
        return NextResponse.json({ posts: [] });
    }
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

    const excludedAuthorIds = viewerId
        ? Array.from(new Set([...blockedIds, ...blockedByIds]))
        : [];

    const followingIds = viewerId
        ? (
              await prisma.follow.findMany({
                  where: { followerId: viewerId },
                  select: { followingId: true },
              })
          ).map((row) => row.followingId)
        : [];

    const posts = await prisma.post.findMany({
        where: {
            content: { contains: query, mode: insensitive },
            ...(excludedAuthorIds.length > 0 ? { authorId: { notIn: excludedAuthorIds } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { id: true, name: true, email: true, isPrivate: true },
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
                email: publicHandleFromEmail(post.author.email),
            },
        })),
    });
}
