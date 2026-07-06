import { AccountStatus, ReportReason, ReportStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import {
  hideReportedPost,
  markReportReviewing,
  rejectReport,
  resolveReport,
  restorePost,
  setReportedUserStatus,
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

const formatDate = (date: Date) =>
  date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

const reportStatuses = [
  ReportStatus.OPEN,
  ReportStatus.REVIEWING,
  ReportStatus.RESOLVED,
  ReportStatus.REJECTED,
] as const;

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
  searchParams?: { status?: string };
}) {
  await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  const statusParam = searchParams?.status?.trim();
  const statusFilter = reportStatuses.find((status) => status === statusParam) ?? ReportStatus.OPEN;

  const [reports, counts] = await Promise.all([
    prisma.report.findMany({
      where: { status: statusFilter },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        reporter: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true, role: true, status: true, suspendedUntil: true } },
        reviewedBy: { select: { id: true, email: true, name: true } },
        post: {
          select: {
            id: true,
            content: true,
            imageUrl: true,
            isHidden: true,
            hiddenReason: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.report.groupBy({
      by: ['status'],
      _count: { _all: true },
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
              href={`/moderation?status=${status}`}
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
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatDate(report.createdAt)} ・ reporter: {reporterLabel} ・ target: {targetLabel}
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
                      投稿 {report.post.isHidden ? '非表示中' : '表示中'}
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

                  {canAct && report.post && !report.post.isHidden && (
                    <form action={hideReportedPost.bind(null, report.id)} className="flex flex-wrap gap-2">
                      <NoteInput placeholder="非表示理由" />
                      <button className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                        投稿を非表示
                      </button>
                    </form>
                  )}

                  {report.post?.isHidden && (
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
