import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { privateJson } from '@/lib/apiResponse';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') ?? '';
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    if (!normalizedQuery.ok) {
        return privateJson({ posts: [], error: normalizedQuery.error }, { status: 400 });
    }
    if (!normalizedQuery.value) {
        return privateJson({ posts: [] });
    }
    const query = normalizedQuery.value;
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
                select: { id: true, name: true, handle: true },
            },
        },
        take: 20,
    });

    return privateJson({
        posts: posts.map((post) => ({
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
