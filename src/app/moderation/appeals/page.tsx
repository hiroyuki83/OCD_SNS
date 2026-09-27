import Link from 'next/link';
import { Prisma, Role, WarningAppealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import ModerationAppealReviewForm from '@/components/moderation/ModerationAppealReviewForm';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';

export const dynamic = 'force-dynamic';

const formatDate = (date: Date) =>
  date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

const appealStatuses = [
  WarningAppealStatus.PENDING,
  WarningAppealStatus.UPHELD,
  WarningAppealStatus.OVERTURNED,
] as const;

function selectedStatus(value?: string) {
  return appealStatuses.find((status) => status === value) ?? null;
}

function appealHref(
  status: WarningAppealStatus | null,
  query: string,
  page = 1,
) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return suffix ? `/moderation/appeals?${suffix}` : '/moderation/appeals';
}

export default async function AppealListPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string; page?: string };
}) {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  const statusFilter = selectedStatus(searchParams?.status);
  const normalizedQuery = normalizeSearchQuery(searchParams?.q ?? '');
  const query = normalizedQuery.ok ? normalizedQuery.value : '';
  const baseFilters: Prisma.WarningAppealWhereInput[] = [];

  if (query) {
    baseFilters.push({
      OR: [
        { id: { contains: query } },
        { message: { contains: query, mode: 'insensitive' } },
        { resolutionNote: { contains: query, mode: 'insensitive' } },
        { warning: { reason: { contains: query, mode: 'insensitive' } } },
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

  const countWhere: Prisma.WarningAppealWhereInput | undefined =
    baseFilters.length > 0 ? { AND: baseFilters } : undefined;
  const where: Prisma.WarningAppealWhereInput = {
    AND: [
      ...(statusFilter ? [{ status: statusFilter }] : []),
      ...baseFilters,
    ],
  };

  const [appealCount, statusCounts] = await Promise.all([
    prisma.warningAppeal.count({ where }),
    prisma.warningAppeal.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
  ]);
  const pagination = clampPage(
    parsePageNumber(searchParams?.page),
    appealCount,
    50,
  );

  const appealCountMap = new Map(
    statusCounts.map((item) => [item.status, item._count._all]),
  );
  const totalMatchingCount = statusCounts.reduce(
    (sum, item) => sum + item._count._all,
    0,
  );

  const appeals = await prisma.warningAppeal.findMany({
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
      warning: {
        select: {
          id: true,
          reason: true,
          createdAt: true,
          reportId: true,
          revokedAt: true,
          actorUserId: true,
        },
      },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/moderation" className="text-sm text-zinc-500 hover:text-zinc-900">
          モデレーションへ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">異議申立て</h1>
        <p className="mt-1 text-sm text-zinc-500">
          警告に対する異議申立てを審査します。
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={appealHref(null, query)}
          className={
            'rounded-full border px-3 py-1 text-xs font-semibold ' +
            (!statusFilter
              ? 'border-black bg-black text-white'
              : 'border-border text-zinc-600')
          }
        >
          すべて {totalMatchingCount}
        </Link>
        {appealStatuses.map((status) => (
          <Link
            key={status}
            href={appealHref(status, query)}
            className={
              'rounded-full border px-3 py-1 text-xs font-semibold ' +
              (statusFilter === status
                ? 'border-black bg-black text-white'
                : 'border-border text-zinc-600')
            }
          >
            {status === WarningAppealStatus.PENDING
              ? '未審査'
              : status === WarningAppealStatus.UPHELD
                ? '警告維持'
                : '警告取消'}{' '}
            {appealCountMap.get(status) ?? 0}
          </Link>
        ))}
      </div>

      <form action="/moderation/appeals" className="mb-4 rounded-lg border border-border p-4">
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-zinc-700">
            検索
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              placeholder={
                actor.role === Role.ADMIN
                  ? '異議内容、警告理由、ユーザー名、@handle、メール'
                  : '異議内容、警告理由、ユーザー名、@handle'
              }
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              検索
            </button>
            <Link
              href={appealHref(statusFilter, '')}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              解除
            </Link>
          </div>
        </div>
      </form>

      <div className="mb-4 text-xs text-zinc-500">
        {appealCount}件・{pagination.page}/{pagination.totalPages}ページ
      </div>

      <div className="flex flex-col gap-3">
        {appeals.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-zinc-500">
            異議申立てはありません。
          </div>
        ) : (
          appeals.map((appeal) => {
            const userLabel = appeal.user.name ?? `@${appeal.user.handle}`;
            const canReviewAppeal =
              appeal.status === WarningAppealStatus.PENDING &&
              appeal.user.id !== actor.id &&
              appeal.warning.actorUserId !== actor.id &&
              (actor.role === Role.ADMIN || appeal.user.role === Role.USER);

            return (
              <article
                key={appeal.id}
                data-appeal-card
                data-appeal-id={appeal.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{userLabel}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      @{appeal.user.handle}
                      {actor.role === Role.ADMIN ? ` / ${appeal.user.email}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{formatDate(appeal.createdAt)}</div>
                </div>

                <div className="mt-3 rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">元の警告</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800">
                    {appeal.warning.reason}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    警告日時: {formatDate(appeal.warning.createdAt)}
                    {appeal.warning.reportId ? ` / report: ${appeal.warning.reportId}` : ''}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-500">異議申立て内容</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-900">
                    {appeal.message}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'rounded-full px-2 py-1 text-xs font-semibold ' +
                      (appeal.status === WarningAppealStatus.PENDING
                        ? 'bg-zinc-100 text-zinc-700'
                        : appeal.status === WarningAppealStatus.UPHELD
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800')
                    }
                  >
                    {appeal.status === WarningAppealStatus.PENDING
                      ? '未審査'
                      : appeal.status === WarningAppealStatus.UPHELD
                        ? '警告維持'
                        : '警告取消'}
                  </span>
                  {appeal.reviewedAt && (
                    <span className="text-xs text-zinc-500">
                      審査: {formatDate(appeal.reviewedAt)}
                    </span>
                  )}
                  {appeal.reviewer && (
                    <span className="text-xs text-zinc-500">
                      reviewer: {appeal.reviewer.name ?? `@${appeal.reviewer.handle}`}
                    </span>
                  )}
                </div>

                {appeal.resolutionNote && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                    <div className="text-xs font-semibold text-zinc-500">審査理由</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">
                      {appeal.resolutionNote}
                    </div>
                  </div>
                )}

                {appeal.warning.revokedAt && appeal.status === WarningAppealStatus.PENDING && (
                  <div className="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800">
                    元の警告は既に取り消されています。審査では「警告を取り消す」のみ選択できます。
                  </div>
                )}

                {canReviewAppeal && (
                  <ModerationAppealReviewForm
                    appealId={appeal.id}
                    allowUphold={!appeal.warning.revokedAt}
                  />
                )}

                {appeal.status === WarningAppealStatus.PENDING && !canReviewAppeal && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    この異議申立ては現在のアカウントでは審査できません。
                  </div>
                )}

                {actor.role === Role.ADMIN && (
                  <div className="mt-3">
                    <Link
                      href={`/admin/users/${appeal.user.id}`}
                      className="text-xs font-semibold text-[#1d9bf0] hover:underline"
                    >
                      ユーザー詳細を開く
                    </Link>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {appealCount > 0 && (
        <div className="mt-4">
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
        </div>
      )}
    </div>
  );
}
