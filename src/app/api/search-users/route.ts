import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { privateJson } from '@/lib/apiResponse';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { normalizeUserSearchTerm, searchableUserWhere } from '@/lib/searchUsers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeSearchQuery(searchParams.get('q') ?? '');
  if (!normalized.ok) {
    return privateJson({ users: [], error: normalized.error }, { status: 400 });
  }

  const term = normalizeUserSearchTerm(normalized.value);
  if (!term) {
    return privateJson({
      users: [],
      totalCount: 0,
      page: 1,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });
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

  const where = searchableUserWhere(viewerId, term, new Date());
  const totalCount = await prisma.user.count({ where });
  const pagination = clampPage(parsePageNumber(searchParams.get('page')), totalCount, 20);

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ handle: 'asc' }, { id: 'asc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      handle: true,
      name: true,
      bio: true,
      avatarUrl: true,
      isPrivate: true,
    },
  });

  return privateJson({
    users,
    totalCount,
    page: pagination.page,
    totalPages: pagination.totalPages,
    hasPrevious: pagination.hasPrevious,
    hasNext: pagination.hasNext,
  });
}
