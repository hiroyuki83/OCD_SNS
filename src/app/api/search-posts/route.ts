import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { privateJson } from '@/lib/apiResponse';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q') ?? '';
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    if (!normalizedQuery.ok) {
        return privateJson({ posts: [], error: normalizedQuery.error }, { status: 400 });
    }
    if (!normalizedQuery.value) {
        return privateJson({
            posts: [],
            totalCount: 0,
            page: 1,
            totalPages: 1,
            hasPrevious: false,
            hasNext: false,
        });
    }
    const query = normalizedQuery.value;
    const requestedPage = parsePageNumber(searchParams.get('page'));
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

    const where: Prisma.PostWhereInput = {
        isHidden: false,
        deletedAt: null,
        content: { contains: query, mode: insensitive },
        author: authorVisibility,
    };

    const totalCount = await prisma.post.count({ where });
    const pagination = clampPage(requestedPage, totalCount, 20);

    const posts = await prisma.post.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
        include: {
            author: {
                select: { id: true, name: true, handle: true },
            },
        },
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
        totalCount,
        page: pagination.page,
        totalPages: pagination.totalPages,
        hasPrevious: pagination.hasPrevious,
        hasNext: pagination.hasNext,
    });
}
