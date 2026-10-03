import Link from 'next/link';
import { AccountStatus, AppealStatus, Prisma, ReportPriority, ReportReason, ReportStatus, Role, WarningAppealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { formatTokyoDateTimeLocal } from '@/lib/tokyoDateTime';

export const dynamic = 'force-dynamic';
import {
  hideReportedPost,
  markReportReviewing,
  rejectReport,
  resolveReport,
  restorePost,
  setReportedUserStatus,
  updateReportRouting,
  warnReportedUser,
} from './actions';

const statusLabels: Record<ReportStatus, string> = {
  OPEN: '未対応',
  REVIEWING: '対応中',
  RESOLVED: '対応済み',
  REJECTED: '却下',
};

const reasonLabels: Record<ReportReason, string> = {
  HARASSMENT: '嫌がらせ・誹謗中傷',
  SPAM: 'スパム',
  IMPERSONATION: 'なりすまし',
  SELF_HARM: '自傷・危険投稿',
  OTHER: 'その他',
};

const priorityLabels: Record<ReportPriority, string> = {
  LOW: '低',
  NORMAL: '通常',
  HIGH: '高',
  URGENT: '緊急',
};

const priorityClassNames: Record<ReportPriority, string> = {
  LOW: 'bg-zinc-100 text-zinc-600',
  NORMAL: 'bg-blue-50 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

const formatDate = (date: Date) =>
  date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

const reportStatuses = [
  ReportStatus.OPEN,
  ReportStatus.REVIEWING,
  ReportStatus.RESOLVED,
  ReportStatus.REJECTED,
] as const;

const reportPriorities = [
  ReportPriority.LOW,
  ReportPriority.NORMAL,
  ReportPriority.HIGH,
  ReportPriority.URGENT,
] as const;

const reportReasons = [
  ReportReason.HARASSMENT,
  ReportReason.SPAM,
  ReportReason.IMPERSONATION,
  ReportReason.SELF_HARM,
  ReportReason.OTHER,
] as const;

function moderationHref(
  status: ReportStatus,
  reason: ReportReason | null,
  query: string,
  priority: ReportPriority | null,
  assignee: string,
  page = 1,
) {
  const params = new URLSearchParams({ status });
  if (reason) params.set('reason', reason);
  if (query) params.set('q', query);
  if (priority) params.set('priority', priority);
  if (assignee) params.set('assigned', assignee);
  if (page > 1) params.set('page', String(page));
  return `/moderation?${params.toString()}`;
}

function NoteInput({
  placeholder = '対応メモ',
  required = false,
  minLength,
}: {
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <input
      name="note"
      type="text"
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      maxLength={500}
      className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-xs"
    />
  );
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    reason?: string;
    q?: string;
    priority?: string;
    assigned?: string;
    page?: string;
  }>;
}) {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);
  const resolvedSearchParams = await searchParams;

  const statusParam = resolvedSearchParams?.status?.trim();
  const statusFilter = reportStatuses.find((status) => status === statusParam) ?? ReportStatus.OPEN;
  const reasonParam = resolvedSearchParams?.reason?.trim();
  const reasonFilter = reportReasons.find((reason) => reason === reasonParam) ?? null;
  const priorityParam = resolvedSearchParams?.priority?.trim();
  const priorityFilter = reportPriorities.find((priority) => priority === priorityParam) ?? null;
  const rawAssigneeFilter = resolvedSearchParams?.assigned?.trim() ?? '';
  const assigneeFilter = rawAssigneeFilter.length <= 128 ? rawAssigneeFilter : '';
  const normalizedQuery = normalizeSearchQuery(resolvedSearchParams?.q ?? '');
  const query = normalizedQuery.ok ? normalizedQuery.value : '';
  const baseFilters: Prisma.ReportWhereInput[] = [];

  if (reasonFilter) {
    baseFilters.push({ reason: reasonFilter });
  }
  if (priorityFilter) {
    baseFilters.push({ priority: priorityFilter });
  }
  if (assigneeFilter === 'unassigned') {
    baseFilters.push({ assignedToId: null });
  } else if (assigneeFilter) {
    baseFilters.push({ assignedToId: assigneeFilter });
  }
  if (query) {
    baseFilters.push({
      OR: [
        { id: { contains: query } },
        { detail: { contains: query, mode: 'insensitive' } },
        { reporterId: { contains: query } },
        { targetUserId: { contains: query } },
        { reporter: {
          OR: [
            { id: { contains: query } },
            { handle: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            ...(actor.role === Role.ADMIN
              ? [{ email: { contains: query, mode: 'insensitive' as const } }]
              : []),
          ],
        } },
        { targetUser: {
          OR: [
            { id: { contains: query } },
            { handle: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            ...(actor.role === Role.ADMIN
              ? [{ email: { contains: query, mode: 'insensitive' as const } }]
              : []),
          ],
        } },
        { post: { content: { contains: query, mode: 'insensitive' } } },
      ],
    });
  }

  const countWhere: Prisma.ReportWhereInput | undefined = baseFilters.length ? { AND: baseFilters } : undefined;
  const where: Prisma.ReportWhereInput = {
    AND: [{ status: statusFilter }, ...baseFilters],
  };

  const [
    counts,
    filteredCount,
    moderatorUsers,
    pendingWarningAppealCount,
    pendingSanctionAppealCount,
  ] = await Promise.all([
    prisma.report.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
    prisma.report.count({ where }),
    prisma.user.findMany({
      where: {
        role: { in: [Role.ADMIN, Role.MODERATOR] },
        AND: [visibleAccountFilter(new Date())],
      },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, email: true, handle: true, name: true, role: true },
    }),
    prisma.warningAppeal.count({
      where: { status: WarningAppealStatus.PENDING },
    }),
    prisma.appeal.count({
      where: { status: AppealStatus.PENDING },
    }),
  ]);

  const pagination = clampPage(
    parsePageNumber(resolvedSearchParams?.page),
    filteredCount,
    50,
  );

  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      reporter: { select: { id: true, email: true, handle: true, name: true } },
      targetUser: {
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          role: true,
          status: true,
          restrictionUntil: true,
          suspendedUntil: true,
        },
      },
      reviewedBy: { select: { id: true, email: true, handle: true, name: true } },
      assignedTo: { select: { id: true, email: true, handle: true, name: true } },
      post: {
        select: {
          id: true,
          content: true,
          isHidden: true,
          hiddenReason: true,
          deletedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const countMap = new Map(counts.map((item) => [item.status, item._count._all]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">モデレーション</h1>
            <p className="mt-1 text-sm text-zinc-500">
              通報を確認し、投稿非表示やユーザー制限を実行します。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/moderation/appeals"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              警告の異議申立て
              {pendingWarningAppealCount > 0
                ? `（未審査 ${pendingWarningAppealCount}）`
                : ''}
            </Link>
            <Link
              href="/moderation/appeals/sanctions"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              処分の異議申立て
              {pendingSanctionAppealCount > 0
                ? `（未審査 ${pendingSanctionAppealCount}）`
                : ''}
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {reportStatuses.map((status) => {
          const active = status === statusFilter;
          return (
            <a
              key={status}
              href={moderationHref(status, reasonFilter, query, priorityFilter, assigneeFilter)}
              className={
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                (active
                  ? 'border-black bg-black text-white'
                  : 'border-border text-zinc-600 hover:text-zinc-900')
              }
            >
              {statusLabels[status]} {countMap.get(status) ?? 0}
            </a>
          );
        })}
      </div>

      <form className="mb-5 rounded-lg border border-border p-4" action="/moderation">
        <div className="grid gap-3 xl:grid-cols-12">
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-4">
            検索
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder={actor.role === Role.ADMIN ? "通報者、対象者、メール、投稿本文、通報詳細" : "通報者、対象者、@handle、投稿本文、通報詳細"}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            状態
            <select
              name="status"
              defaultValue={statusFilter}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              {reportStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            理由
            <select
              name="reason"
              defaultValue={reasonFilter ?? ''}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              {reportReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reasonLabels[reason]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            優先度
            <select
              name="priority"
              defaultValue={priorityFilter ?? ''}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              {reportPriorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            担当者
            <select
              name="assigned"
              defaultValue={assigneeFilter}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              <option value="unassigned">未担当</option>
              {moderatorUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? `@${user.handle}`}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:col-span-12">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              絞り込み
            </button>
            <a
              href="/moderation"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              解除
            </a>
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          {filteredCount === 0
            ? '0件'
            : `${pagination.skip + 1}〜${Math.min(
                pagination.skip + reports.length,
                filteredCount,
              )}件目`} / {filteredCount}件
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {reports.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-zinc-500">
            表示する通報はありません。
          </div>
        ) : (
          reports.map((report) => {
            const canAct = report.status === ReportStatus.OPEN || report.status === ReportStatus.REVIEWING;
            const canReviewTarget = actor.role === Role.ADMIN || report.targetUser.role === Role.USER;
            const canSanctionTarget =
              report.targetUser.role !== Role.ADMIN && canReviewTarget;
            const reporterLabel =
              actor.role === Role.ADMIN
                ? report.reporter.email ?? report.reporter.name ?? `@${report.reporter.handle}`
                : report.reporter.name ?? `@${report.reporter.handle}`;
            const targetLabel =
              actor.role === Role.ADMIN
                ? report.targetUser.email ?? report.targetUser.name ?? `@${report.targetUser.handle}`
                : report.targetUser.name ?? `@${report.targetUser.handle}`;
            const assigneeLabel = report.assignedTo
              ? report.assignedTo.name ?? `@${report.assignedTo.handle}`
              : '未担当';
            const excerpt = report.post?.content?.trim()
              ? report.post.content.trim().slice(0, 160)
              : '投稿本文なし';

            return (
              <div
                key={report.id}
                data-report-card
                data-report-id={report.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {reasonLabels[report.reason]} / {statusLabels[report.status]}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full px-2 py-0.5 ${priorityClassNames[report.priority]}`}>
                        優先度: {priorityLabels[report.priority]}
                      </span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                        担当: {assigneeLabel}
                      </span>
                      {report.dueAt && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                          期限: {formatDate(report.dueAt)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatDate(report.createdAt)} ・ reporter:{' '}
                      {actor.role === Role.ADMIN ? (
                        <Link href={`/admin/users/${report.reporter.id}`} className="hover:underline">
                          {reporterLabel}
                        </Link>
                      ) : (
                        <span>{reporterLabel}</span>
                      )}{' '}
                      ・ target:{' '}
                      {actor.role === Role.ADMIN ? (
                        <Link href={`/admin/users/${report.targetUser.id}`} className="hover:underline">
                          {targetLabel}
                        </Link>
                      ) : (
                        <span>{targetLabel}</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      target status: {report.targetUser.status}
                      {report.targetUser.restrictionUntil
                        ? ` restriction until ${formatDate(report.targetUser.restrictionUntil)}`
                        : ''}
                      {report.targetUser.suspendedUntil
                        ? ` suspended until ${formatDate(report.targetUser.suspendedUntil)}`
                        : ''}
                    </div>
                  </div>
                  {report.reviewedBy && (
                    <div className="text-xs text-zinc-500">
                      reviewed by {report.reviewedBy.name ?? `@${report.reviewedBy.handle}`}
                    </div>
                  )}
                </div>

                {report.detail && (
                  <div className="mb-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                    {report.detail}
                  </div>
                )}

                {report.post && (
                  <div className="mb-3 rounded-md border border-border p-3">
                    <div className="mb-1 text-xs font-semibold text-zinc-500">
                      投稿 {report.post.deletedAt ? '削除済み' : report.post.isHidden ? '非表示中' : '表示中'}
                    </div>
                    <div className="whitespace-pre-wrap break-words text-sm text-zinc-800">{excerpt}</div>
                    {report.post.hiddenReason && (
                      <div className="mt-2 text-xs text-zinc-500">非表示理由: {report.post.hiddenReason}</div>
                    )}
                  </div>
                )}

                {report.resolutionNote && (
                  <div className="mb-3 text-xs text-zinc-500">対応メモ: {report.resolutionNote}</div>
                )}

                <div className="flex flex-col gap-2">
                  {!canReviewTarget && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                      スタッフ対象の通報はADMINのみ対応できます。
                    </div>
                  )}

                  {canAct && canReviewTarget && (
                  <form
                    action={updateReportRouting.bind(null, report.id)}
                    className="grid gap-2 rounded-md bg-zinc-50 p-3 md:grid-cols-12"
                  >
                    <label className="block text-xs font-semibold text-zinc-600 md:col-span-2">
                      優先度
                      <select
                        name="priority"
                        defaultValue={report.priority}
                        className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
                      >
                        {reportPriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priorityLabels[priority]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-zinc-600 md:col-span-3">
                      担当者
                      <select
                        name="assignedToId"
                        defaultValue={report.assignedToId ?? ''}
                        className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
                      >
                        <option value="">未担当</option>
                        {(report.targetUser.role === Role.USER
                          ? moderatorUsers
                          : moderatorUsers.filter((user) => user.role === Role.ADMIN)
                        ).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name ?? `@${user.handle}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-zinc-600 md:col-span-3">
                      対応期限
                      <input
                        name="dueAt"
                        type="datetime-local"
                        defaultValue={formatTokyoDateTimeLocal(report.dueAt)}
                        className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-zinc-600 md:col-span-3">
                      メモ
                      <input
                        name="note"
                        type="text"
                        maxLength={500}
                        placeholder="割り当て理由など"
                        className="mt-1 w-full rounded-md border border-border bg-white px-2 py-1 text-xs"
                      />
                    </label>
                    <div className="flex items-end md:col-span-1">
                      <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                        保存
                      </button>
                    </div>
                  </form>
                  )}

                  {canAct && canReviewTarget && (
                    <div className="flex flex-wrap gap-2">
                      <form action={markReportReviewing.bind(null, report.id)}>
                        <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                          対応中
                        </button>
                      </form>
                      <form action={resolveReport.bind(null, report.id)} className="flex min-w-[220px] flex-1 gap-2">
                        <NoteInput />
                        <button className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                          対応済み
                        </button>
                      </form>
                      <form action={rejectReport.bind(null, report.id)} className="flex min-w-[220px] flex-1 gap-2">
                        <NoteInput placeholder="却下理由" />
                        <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                          却下
                        </button>
                      </form>
                    </div>
                  )}

                  {canAct && canReviewTarget && report.post && !report.post.deletedAt && !report.post.isHidden && (
                    <form action={hideReportedPost.bind(null, report.id)} className="flex flex-wrap gap-2">
                      <NoteInput placeholder="非表示理由" />
                      <button className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                        投稿を非表示
                      </button>
                    </form>
                  )}

                  {canReviewTarget && report.post?.isHidden && !report.post.deletedAt && (
                    <form
                      action={restorePost.bind(null, report.post.id, report.targetUser.id)}
                      className="flex flex-wrap gap-2"
                    >
                      <NoteInput placeholder="再表示理由" />
                      <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                        投稿を再表示
                      </button>
                    </form>
                  )}

                  {canAct && canSanctionTarget && (
                    <form action={warnReportedUser.bind(null, report.id)} className="flex flex-wrap gap-2">
                      <NoteInput placeholder="警告理由（5文字以上）" required minLength={5} />
                      <button className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-800">
                        警告して解決
                      </button>
                    </form>
                  )}

                  {canAct && canSanctionTarget && (
                    <div className="flex flex-wrap gap-2">
                      <form
                        action={setReportedUserStatus.bind(null, report.id, AccountStatus.POST_RESTRICTED)}
                        className="flex min-w-[320px] flex-1 flex-wrap gap-2"
                      >
                        <NoteInput placeholder="投稿制限理由（5文字以上）" required minLength={5} />
                        <select
                          name="durationHours"
                          defaultValue="24"
                          className="rounded-md border border-border bg-white px-2 py-1 text-xs"
                          aria-label="投稿制限期間"
                        >
                          <option value="1">1時間</option>
                          <option value="24">24時間</option>
                          <option value="72">3日</option>
                        </select>
                        <button className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700">
                          投稿制限
                        </button>
                      </form>
                      <form
                        action={setReportedUserStatus.bind(null, report.id, AccountStatus.SUSPENDED)}
                        className="flex min-w-[320px] flex-1 flex-wrap gap-2"
                      >
                        <NoteInput placeholder="停止理由（5文字以上）" required minLength={5} />
                        <select
                          name="durationDays"
                          defaultValue="7"
                          className="rounded-md border border-border bg-white px-2 py-1 text-xs"
                          aria-label="アカウント停止期間"
                        >
                          <option value="1">1日</option>
                          <option value="7">7日</option>
                          <option value="30">30日</option>
                          {actor.role === Role.ADMIN && (
                            <option value="permanent">永久停止</option>
                          )}
                        </select>
                        <button className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">
                          アカウント停止
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredCount > 0 && (
        <div className="mt-4">
          <PaginationLinks
            page={pagination.page}
            totalPages={pagination.totalPages}
            previousHref={
              pagination.hasPrevious
                ? moderationHref(
                    statusFilter,
                    reasonFilter,
                    query,
                    priorityFilter,
                    assigneeFilter,
                    pagination.page - 1,
                  )
                : null
            }
            nextHref={
              pagination.hasNext
                ? moderationHref(
                    statusFilter,
                    reasonFilter,
                    query,
                    priorityFilter,
                    assigneeFilter,
                    pagination.page + 1,
                  )
                : null
            }
          />
        </div>
      )}
    </div>
  );
}
