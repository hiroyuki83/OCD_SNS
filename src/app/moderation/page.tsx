import Link from 'next/link';
import { AccountStatus, Prisma, ReportPriority, ReportReason, ReportStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import {
  hideReportedPost,
  markReportReviewing,
  rejectReport,
  resolveReport,
  restorePost,
  setReportedUserStatus,
  updateReportRouting,
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

const formatDateInput = (date: Date | null) => {
  if (!date) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

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
) {
  const params = new URLSearchParams({ status });
  if (reason) params.set('reason', reason);
  if (query) params.set('q', query);
  if (priority) params.set('priority', priority);
  if (assignee) params.set('assigned', assignee);
  return `/moderation?${params.toString()}`;
}

function NoteInput({ placeholder = '対応メモ' }: { placeholder?: string }) {
  return (
    <input
      name="note"
      type="text"
      placeholder={placeholder}
      className="min-w-0 flex-1 rounded-md border border-border px-2 py-1 text-xs"
    />
  );
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams?: { status?: string; reason?: string; q?: string; priority?: string; assigned?: string };
}) {
  await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  const statusParam = searchParams?.status?.trim();
  const statusFilter = reportStatuses.find((status) => status === statusParam) ?? ReportStatus.OPEN;
  const reasonParam = searchParams?.reason?.trim();
  const reasonFilter = reportReasons.find((reason) => reason === reasonParam) ?? null;
  const priorityParam = searchParams?.priority?.trim();
  const priorityFilter = reportPriorities.find((priority) => priority === priorityParam) ?? null;
  const assigneeFilter = searchParams?.assigned?.trim() ?? '';
  const query = searchParams?.q?.trim() ?? '';
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
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        } },
        { targetUser: {
          OR: [
            { id: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
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

  const [reports, counts, filteredCount, moderatorUsers] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true, role: true, status: true, suspendedUntil: true } },
        reviewedBy: { select: { id: true, email: true, name: true } },
        assignedTo: { select: { id: true, email: true, name: true } },
        post: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            isHidden: true,
            hiddenReason: true,
            deletedAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.report.groupBy({
      by: ['status'],
      where: countWhere,
      _count: { _all: true },
    }),
    prisma.report.count({ where }),
    prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.MODERATOR] } },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      select: { id: true, email: true, name: true, role: true },
      take: 100,
    }),
  ]);

  const countMap = new Map(counts.map((item) => [item.status, item._count._all]));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">モデレーション</h1>
        <p className="mt-1 text-sm text-zinc-500">
          通報を確認し、投稿非表示やユーザー制限を実行します。
        </p>
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
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="通報者、対象者、投稿本文、通報詳細"
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
                  {user.email ?? user.name ?? user.id}
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
          {filteredCount} 件を表示しています。最大100件まで表示します。
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
            const reporterLabel = report.reporter.email ?? report.reporter.name ?? report.reporter.id;
            const targetLabel = report.targetUser.email ?? report.targetUser.name ?? report.targetUser.id;
            const assigneeLabel = report.assignedTo
              ? report.assignedTo.email ?? report.assignedTo.name ?? report.assignedTo.id
              : '未担当';
            const excerpt = report.post?.content?.trim()
              ? report.post.content.trim().slice(0, 160)
              : report.post?.imageUrl
                ? '画像投稿'
                : '投稿本文なし';

            return (
              <div key={report.id} className="rounded-lg border border-border p-4">
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
                      <Link href={`/admin/users/${report.reporter.id}`} className="hover:underline">
                        {reporterLabel}
                      </Link>{' '}
                      ・ target:{' '}
                      <Link href={`/admin/users/${report.targetUser.id}`} className="hover:underline">
                        {targetLabel}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      target status: {report.targetUser.status}
                      {report.targetUser.suspendedUntil ? ` until ${formatDate(report.targetUser.suspendedUntil)}` : ''}
                    </div>
                  </div>
                  {report.reviewedBy && (
                    <div className="text-xs text-zinc-500">
                      reviewed by {report.reviewedBy.email ?? report.reviewedBy.name}
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
                        {moderatorUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.email ?? user.name ?? user.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-xs font-semibold text-zinc-600 md:col-span-3">
                      対応期限
                      <input
                        name="dueAt"
                        type="datetime-local"
                        defaultValue={formatDateInput(report.dueAt)}
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

                  {canAct && (
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

                  {canAct && report.post && !report.post.deletedAt && !report.post.isHidden && (
                    <form action={hideReportedPost.bind(null, report.id)} className="flex flex-wrap gap-2">
                      <NoteInput placeholder="非表示理由" />
                      <button className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                        投稿を非表示
                      </button>
                    </form>
                  )}

                  {report.post?.isHidden && !report.post.deletedAt && (
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

                  {canAct && (
                    <div className="flex flex-wrap gap-2">
                      <form
                        action={setReportedUserStatus.bind(null, report.id, AccountStatus.POST_RESTRICTED)}
                        className="flex min-w-[240px] flex-1 gap-2"
                      >
                        <NoteInput placeholder="投稿制限理由" />
                        <button className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700">
                          投稿制限
                        </button>
                      </form>
                      <form
                        action={setReportedUserStatus.bind(null, report.id, AccountStatus.SUSPENDED)}
                        className="flex min-w-[240px] flex-1 gap-2"
                      >
                        <NoteInput placeholder="停止理由" />
                        <button className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-700">
                          7日停止
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
    </div>
  );
}
