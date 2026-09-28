import Link from 'next/link';
import {
  AppealStatus,
  Prisma,
  Role,
  SanctionStatus,
  SanctionType,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import SanctionAppealReviewForm from '@/components/moderation/SanctionAppealReviewForm';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';

export const dynamic = 'force-dynamic';

const formatDate = (date: Date | null) =>
  date ? date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '-';

const appealStatuses = [
  AppealStatus.PENDING,
  AppealStatus.UPHELD,
  AppealStatus.OVERTURNED,
] as const;

const statusLabels: Record<AppealStatus, string> = {
  PENDING: '審査中',
  UPHELD: '処分維持',
  OVERTURNED: '処分取消',
};

const sanctionLabels: Record<SanctionType, string> = {
  WARNING: '警告',
  POST_RESTRICTION: '投稿制限',
  SUSPENSION: 'アカウント停止',
};

function selectedStatus(value?: string) {
  return appealStatuses.find((status) => status === value) ?? null;
}

function appealHref(status: AppealStatus | null, query: string, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return suffix
    ? `/moderation/appeals/sanctions?${suffix}`
    : '/moderation/appeals/sanctions';
}

export default async function SanctionAppealListPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  const resolvedSearchParams = await searchParams;
  const statusFilter = selectedStatus(resolvedSearchParams?.status);
  const normalizedQuery = normalizeSearchQuery(resolvedSearchParams?.q ?? '');
  const query = normalizedQuery.ok ? normalizedQuery.value : '';
  const baseFilters: Prisma.AppealWhereInput[] = [];

  if (query) {
    baseFilters.push({
      OR: [
        { id: { contains: query } },
        { message: { contains: query, mode: 'insensitive' } },
        { resolutionNote: { contains: query, mode: 'insensitive' } },
        { sanction: { id: { contains: query } } },
        { sanction: { reason: { contains: query, mode: 'insensitive' } } },
        {
          user: {
            OR: [
              { id: { contains: query } },
              { handle: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
              ...(actor.role === Role.ADMIN
                ? [{ email: { contains: query, mode: 'insensitive' as const } }]
                : []),
            ],
          },
        },
      ],
    });
  }

  const countWhere: Prisma.AppealWhereInput | undefined =
    baseFilters.length > 0 ? { AND: baseFilters } : undefined;

  const where: Prisma.AppealWhereInput = {
    AND: [
      ...(statusFilter ? [{ status: statusFilter }] : []),
      ...baseFilters,
    ],
  };

  const [appealCount, statusCounts] = await Promise.all([
    prisma.appeal.count({ where }),
    prisma.appeal.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
  ]);

  const pagination = clampPage(
    parsePageNumber(resolvedSearchParams?.page),
    appealCount,
    50,
  );

  const countMap = new Map(
    statusCounts.map((item) => [item.status, item._count._all]),
  );
  const totalMatchingCount = statusCounts.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );

  const appeals = await prisma.appeal.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          email: true,
          role: true,
        },
      },
      reviewer: {
        select: {
          id: true,
          handle: true,
          name: true,
          email: true,
        },
      },
      sanction: {
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          createdAt: true,
          startsAt: true,
          endsAt: true,
          revokedAt: true,
          reportId: true,
          actorUserId: true,
        },
      },
    },
  });

  const now = new Date();

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/moderation/appeals"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          警告への異議申立てへ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">処分への異議申立て</h1>
        <p className="mt-1 text-sm text-zinc-500">
          投稿制限・アカウント停止に対する異議申立てを審査します。
        </p>
      </div>

      <form className="mb-5 flex flex-wrap gap-2" method="get">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={100}
          placeholder="申立て本文・処分理由・ユーザーを検索"
          className="min-w-64 flex-1 rounded-md border border-border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
        >
          検索
        </button>
        {query && (
          <Link
            href={appealHref(statusFilter, '')}
            className="rounded-full border border-border px-4 py-2 text-sm"
          >
            解除
          </Link>
        )}
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={appealHref(null, query)}
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
        >
          すべて {totalMatchingCount}
        </Link>
        {appealStatuses.map((status) => (
          <Link
            key={status}
            href={appealHref(status, query)}
            className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
          >
            {statusLabels[status]} {countMap.get(status) ?? 0}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {appeals.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-sm text-zinc-500">
            条件に一致する異議申立てはありません。
          </div>
        ) : (
          appeals.map((appeal) => {
            const effectiveSanctionStatus =
              appeal.sanction.status === SanctionStatus.ACTIVE &&
              appeal.sanction.endsAt &&
              appeal.sanction.endsAt <= now
                ? SanctionStatus.EXPIRED
                : appeal.sanction.status;

            const canReview =
              appeal.status === AppealStatus.PENDING &&
              appeal.userId !== actor.id &&
              appeal.sanction.actorUserId !== actor.id &&
              (actor.role === Role.ADMIN || appeal.user.role === Role.USER);

            return (
              <article
                key={appeal.id}
                data-sanction-appeal-card
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">
                      {sanctionLabels[appeal.sanction.type]}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      @{appeal.user.handle}
                      {appeal.user.name ? ` / ${appeal.user.name}` : ''}
                      {actor.role === Role.ADMIN ? ` / ${appeal.user.email}` : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>{statusLabels[appeal.status]}</div>
                    <div className="mt-1">{formatDate(appeal.createdAt)}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                  <div className="text-xs font-semibold text-zinc-500">処分理由</div>
                  <div className="mt-1 whitespace-pre-wrap break-words">
                    {appeal.sanction.reason}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    状態: {effectiveSanctionStatus}
                    {' / '}
                    開始: {formatDate(appeal.sanction.startsAt)}
                    {' / '}
                    期限: {formatDate(appeal.sanction.endsAt)}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-500">申立て内容</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800">
                    {appeal.message}
                  </div>
                </div>

                {appeal.resolutionNote && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
                    <div className="text-xs font-semibold text-zinc-500">審査理由</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">
                      {appeal.resolutionNote}
                    </div>
                    <div className="mt-2 text-xs text-zinc-500">
                      審査日時: {formatDate(appeal.reviewedAt)}
                      {appeal.reviewer
                        ? ` / reviewer: ${appeal.reviewer.email ?? appeal.reviewer.handle ?? appeal.reviewer.id}`
                        : ''}
                    </div>
                  </div>
                )}

                {canReview && (
                  <SanctionAppealReviewForm
                    appealId={appeal.id}
                    allowUphold={
                      effectiveSanctionStatus !== SanctionStatus.REVOKED
                    }
                  />
                )}

                {appeal.status === AppealStatus.PENDING && !canReview && (
                  <p className="mt-3 text-xs text-zinc-500">
                    この申立ては、別の権限を持つスタッフによる審査が必要です。
                  </p>
                )}

                <div className="mt-3 text-xs text-zinc-500">
                  sanction: {appeal.sanction.id}
                  {appeal.sanction.reportId
                    ? ` / report: ${appeal.sanction.reportId}`
                    : ''}
                </div>
              </article>
            );
          })
        )}
      </div>

      {appealCount > 0 && (
        <PaginationLinks
          page={pagination.page}
          totalPages={pagination.totalPages}
          previousHref={
            pagination.hasPrevious
              ? appealHref(statusFilter, query, pagination.page - 1)
              : null
          }
          nextHref={
            pagination.hasNext
              ? appealHref(statusFilter, query, pagination.page + 1)
              : null
          }
        />
      )}
    </div>
  );
}
