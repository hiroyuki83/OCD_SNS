import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { visibleAccountFilter } from '@/lib/accountStatus';

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

    const now = new Date();
    const authorVisibility: Prisma.UserWhereInput = viewerId
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

    const posts = await prisma.post.findMany({
        where: {
            isHidden: false,
            deletedAt: null,
            content: { contains: query, mode: insensitive },
            author: authorVisibility,
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
