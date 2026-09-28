import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountStatus, AppealStatus, ReportReason, ReportStatus, Role, SanctionStatus, SanctionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import AdminNotesPanel from "../AdminNotesPanel";
import UserAccessPanel from "../UserAccessPanel";
import UserPasswordResetForm from "../UserPasswordResetForm";
import { visibleAccountFilter } from "@/lib/accountStatus";
import { buildModerationTimeline } from "@/lib/moderationTimeline";

export const dynamic = "force-dynamic";

const statusLabels: Record<ReportStatus, string> = {
  OPEN: "未対応",
  REVIEWING: "対応中",
  RESOLVED: "対応済み",
  REJECTED: "却下",
};

const reasonLabels: Record<ReportReason, string> = {
  HARASSMENT: "嫌がらせ・誹謗中傷",
  SPAM: "スパム",
  IMPERSONATION: "なりすまし",
  SELF_HARM: "自傷・危険投稿",
  OTHER: "その他",
};

const accountStatusLabels: Record<AccountStatus, string> = {
  ACTIVE: "通常",
  POST_RESTRICTED: "投稿制限",
  SUSPENDED: "停止中",
};

const sanctionTypeLabels: Record<SanctionType, string> = {
  WARNING: "警告",
  POST_RESTRICTION: "投稿制限",
  SUSPENSION: "アカウント停止",
};

const sanctionStatusLabels: Record<SanctionStatus, string> = {
  ACTIVE: "有効",
  EXPIRED: "期限切れ",
  REVOKED: "解除済み",
};

const appealStatusLabels: Record<AppealStatus, string> = {
  PENDING: "異議申立て審査中",
  UPHELD: "異議申立て結果: 処分維持",
  OVERTURNED: "異議申立て結果: 処分取消",
};

const formatDate = (date: Date | null) =>
  date ? date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "-";

const shortText = (value: string | null | undefined, max = 140) => {
  const text = value?.trim();
  if (!text) return "本文なし";
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

function StatBox({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm font-medium text-zinc-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-zinc-900">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{helper}</div>
    </div>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.ADMIN);
  const resolvedParams = await params;

  const userId = resolvedParams.id.trim();
  if (!userId || userId.length > 128) notFound();
  const now = new Date();
  const [
    user,
    visiblePostCount,
    hiddenPostCount,
    deletedPostCount,
    openReports,
    reviewingReports,
    reportsMadeCount,
    followerCount,
    followingCount,
    recentPosts,
    reportsTargetingUser,
    reportsMade,
    warningCount,
    warnings,
    sanctions,
    adminNotes,
    auditLogs,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        autoHashtag: true,
        isPrivate: true,
        role: true,
        status: true,
        restrictionReason: true,
        restrictionUntil: true,
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.post.count({ where: { authorId: userId, isHidden: false, deletedAt: null } }),
    prisma.post.count({ where: { authorId: userId, isHidden: true, deletedAt: null } }),
    prisma.post.count({ where: { authorId: userId, deletedAt: { not: null } } }),
    prisma.report.count({ where: { targetUserId: userId, status: ReportStatus.OPEN } }),
    prisma.report.count({ where: { targetUserId: userId, status: ReportStatus.REVIEWING } }),
    prisma.report.count({ where: { reporterId: userId } }),
    prisma.follow.count({
      where: {
        followingId: userId,
        acceptedAt: { not: null },
        follower: visibleAccountFilter(now),
      },
    }),
    prisma.follow.count({
      where: {
        followerId: userId,
        acceptedAt: { not: null },
        following: visibleAccountFilter(now),
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        isHidden: true,
        hiddenReason: true,
        deletedAt: true,
        wakaruCount: true,
        ganbattaCount: true,
        _count: { select: { likes: true } },
      },
    }),
    prisma.report.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        reporter: { select: { id: true, email: true, name: true } },
        post: { select: { id: true, content: true, isHidden: true, deletedAt: true } },
      },
    }),
    prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        targetUser: { select: { id: true, email: true, name: true } },
        post: { select: { id: true, content: true, isHidden: true, deletedAt: true } },
      },
    }),
    prisma.moderationWarning.count({ where: { targetUserId: userId, revokedAt: null } }),
    prisma.moderationWarning.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        revokedAt: true,
        reason: true,
        reportId: true,
        actorUser: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.sanction.findMany({
      where: { targetUserId: userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: {
        id: true,
        createdAt: true,
        startsAt: true,
        endsAt: true,
        revokedAt: true,
        type: true,
        status: true,
        reason: true,
        reportId: true,
        actorUser: { select: { id: true, email: true, name: true } },
        appeal: {
          select: {
            id: true,
            createdAt: true,
            message: true,
            status: true,
            resolutionNote: true,
            reviewedAt: true,
            reviewer: { select: { id: true, email: true, name: true } },
          },
        },
      },
    }),
    prisma.adminNote.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        author: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actorUser: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  if (!user) notFound();

  const [
    reportsTargetingCount,
    warningHistoryCount,
    sanctionHistoryCount,
    adminNoteCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.report.count({ where: { targetUserId: userId } }),
    prisma.moderationWarning.count({ where: { targetUserId: userId } }),
    prisma.sanction.count({ where: { targetUserId: userId } }),
    prisma.adminNote.count({ where: { targetUserId: userId } }),
    prisma.auditLog.count({ where: { targetUserId: userId } }),
  ]);
  const totalPostCount = visiblePostCount + hiddenPostCount + deletedPostCount;
  const moderationTimeline = buildModerationTimeline({
    warnings: warnings.map((warning) => ({
      id: warning.id,
      createdAt: warning.createdAt,
      revokedAt: warning.revokedAt,
      reason: warning.reason,
    })),
    reports: reportsTargetingUser.map((report) => ({
      id: report.id,
      createdAt: report.createdAt,
      reason: report.reason,
      status: report.status,
      detail: report.detail,
    })),
    sanctions: sanctions.map((sanction) => ({
      id: sanction.id,
      createdAt: sanction.createdAt,
      startsAt: sanction.startsAt,
      endsAt: sanction.endsAt,
      revokedAt: sanction.revokedAt,
      type: sanction.type,
      status: sanction.status,
      reason: sanction.reason,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      meta: log.meta,
    })),
  }).slice(0, 30);

  const identity = user.email ?? user.name ?? user.id;
  const stats = [
    { label: "公開投稿", value: visiblePostCount, helper: "表示中の投稿" },
    { label: "非表示投稿", value: hiddenPostCount, helper: "モデレーション済み" },
    { label: "削除済み投稿", value: deletedPostCount, helper: "本人削除の証跡" },
    { label: "未対応通報", value: openReports, helper: `対応中 ${reviewingReports} 件` },
    { label: "有効な警告", value: warningCount, helper: "取消済みは除外" },
    { label: "通報送信", value: reportsMadeCount, helper: "このユーザーが送った通報" },
    { label: "フォロワー", value: followerCount, helper: "このユーザーをフォロー" },
    { label: "フォロー中", value: followingCount, helper: "このユーザーがフォロー" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-900">
          ユーザー管理へ戻る
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{user.name ?? "(no name)"}</h1>
            <p className="mt-1 text-sm text-zinc-500">{identity}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-border px-3 py-1">{user.role}</span>
            <span
              className={
                "rounded-full px-3 py-1 " +
                (user.status === AccountStatus.ACTIVE
                  ? "bg-green-100 text-green-700"
                  : user.status === AccountStatus.POST_RESTRICTED
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700")
              }
            >
              {accountStatusLabels[user.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <StatBox key={stat.label} {...stat} />
        ))}
      </div>

      <UserAccessPanel
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
        }}
      />

      <UserPasswordResetForm userId={user.id} />

      <AdminNotesPanel
        userId={user.id}
        totalCount={adminNoteCount}
        notes={adminNotes.map((note) => ({
          id: note.id,
          body: note.body,
          createdAt: note.createdAt.toISOString(),
          authorLabel: note.author.email ?? note.author.name ?? note.author.id,
        }))}
      />

      <section className="mb-6 rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">モデレーション・制裁タイムライン</h2>
          <span className="text-xs text-zinc-500">最新{moderationTimeline.length}件</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          このユーザーへの通報、警告、主要な制裁操作を時系列でまとめています。詳細は下の各履歴と監査ログで確認できます。
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {moderationTimeline.length === 0 ? (
            <div className="text-sm text-zinc-500">モデレーション履歴はありません。</div>
          ) : (
            moderationTimeline.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-900">{item.title}</div>
                  <div className="text-xs text-zinc-500">{formatDate(item.createdAt)}</div>
                </div>
                {item.status && (
                  <div className="mt-1 text-xs font-medium text-zinc-500">状態: {item.status}</div>
                )}
                {item.detail && (
                  <div className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-700">
                    {shortText(item.detail, 220)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold text-zinc-900">処分履歴</h2>
        <p className="mt-1 text-xs text-zinc-500">
          投稿制限・アカウント停止を独立した処分レコードとして保存しています。
          {sanctionHistoryCount > sanctions.length
            ? ` 最新${sanctions.length}件 / 全${sanctionHistoryCount}件を表示しています。`
            : sanctionHistoryCount > 0
              ? ` 全${sanctionHistoryCount}件です。`
              : ""}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {sanctions.length === 0 ? (
            <div className="text-sm text-zinc-500">処分履歴はありません。</div>
          ) : (
            sanctions.map((sanction) => {
              const effectiveStatus =
                sanction.status === SanctionStatus.ACTIVE &&
                sanction.endsAt &&
                sanction.endsAt.getTime() <= now.getTime()
                  ? SanctionStatus.EXPIRED
                  : sanction.status;
              return (
                <div key={sanction.id} className="rounded-md bg-zinc-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-900">
                      {sanctionTypeLabels[sanction.type]}
                    </div>
                    <div className="text-xs text-zinc-500">{formatDate(sanction.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-xs font-medium text-zinc-600">
                    状態: {sanctionStatusLabels[effectiveStatus]}
                    {sanction.endsAt ? ` / 期限: ${formatDate(sanction.endsAt)}` : " / 期限: なし"}
                  </div>
                  <div className="mt-2 whitespace-pre-wrap break-words text-zinc-800">
                    {sanction.reason}
                  </div>
                  {sanction.revokedAt && (
                    <div className="mt-2 text-xs text-zinc-600">
                      解除日時: {formatDate(sanction.revokedAt)}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-zinc-500">
                    actor: {sanction.actorUser.email ?? sanction.actorUser.name ?? sanction.actorUser.id}
                    {sanction.reportId ? ` / report: ${sanction.reportId}` : ""}
                  </div>
                  {sanction.appeal && (
                    <div className="mt-3 rounded-md border border-border bg-white p-3">
                      <div className="text-xs font-semibold text-zinc-700">
                        {appealStatusLabels[sanction.appeal.status]}
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-700">
                        申立て: {sanction.appeal.message}
                      </div>
                      {sanction.appeal.resolutionNote && (
                        <div className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-700">
                          審査理由: {sanction.appeal.resolutionNote}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-zinc-500">
                        申立て日時: {formatDate(sanction.appeal.createdAt)}
                        {sanction.appeal.reviewedAt
                          ? ` / 審査日時: ${formatDate(sanction.appeal.reviewedAt)}`
                          : ""}
                        {sanction.appeal.reviewer
                          ? ` / reviewer: ${sanction.appeal.reviewer.email ?? sanction.appeal.reviewer.name ?? sanction.appeal.reviewer.id}`
                          : ""}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold text-zinc-900">警告履歴</h2>
        <p className="mt-1 text-xs text-zinc-500">
          通報対応で発行された警告です。警告の発行は監査ログにも記録されます。
          {warningHistoryCount > warnings.length
            ? ` 最新${warnings.length}件 / 全${warningHistoryCount}件を表示しています。`
            : warningHistoryCount > 0
              ? ` 全${warningHistoryCount}件です。`
              : ''}
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {warnings.length === 0 ? (
            <div className="text-sm text-zinc-500">警告はありません。</div>
          ) : (
            warnings.map((warning) => (
              <div key={warning.id} className="rounded-md bg-zinc-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className={warning.revokedAt ? "font-semibold text-green-800" : "font-semibold text-amber-800"}>
                    {warning.revokedAt ? "警告（取消済み）" : "警告"}
                  </div>
                  <div className="text-xs text-zinc-500">{formatDate(warning.createdAt)}</div>
                </div>
                <div className="mt-2 whitespace-pre-wrap break-words text-zinc-800">
                  {warning.reason}
                </div>
                {warning.revokedAt && (
                  <div className="mt-2 text-xs font-semibold text-green-700">
                    取消日時: {formatDate(warning.revokedAt)}
                  </div>
                )}
                <div className="mt-2 text-xs text-zinc-500">
                  actor: {warning.actorUser.email ?? warning.actorUser.name ?? warning.actorUser.id}
                  {warning.reportId ? ` / report: ${warning.reportId}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </section>


      <div className="mb-6 rounded-lg border border-border p-4">
        <h2 className="text-base font-semibold text-zinc-900">プロフィール</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-zinc-500">ユーザーID</dt>
            <dd className="mt-1 break-all text-zinc-800">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">作成日</dt>
            <dd className="mt-1 text-zinc-800">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">更新日</dt>
            <dd className="mt-1 text-zinc-800">{formatDate(user.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">公開設定</dt>
            <dd className="mt-1 text-zinc-800">{user.isPrivate ? "非公開" : "公開"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">自動ハッシュタグ</dt>
            <dd className="mt-1 text-zinc-800">{user.autoHashtag ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">投稿制限期限</dt>
            <dd className="mt-1 text-zinc-800">{formatDate(user.restrictionUntil)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-zinc-500">停止期限</dt>
            <dd className="mt-1 text-zinc-800">{formatDate(user.suspendedUntil)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-zinc-500">制限理由</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">
              {user.restrictionReason ?? "-"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold text-zinc-500">Bio</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-zinc-800">{user.bio ?? "-"}</dd>
          </div>
        </dl>
      </div>

      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">最近の投稿</h2>
          <span className="text-xs text-zinc-500">
            {totalPostCount > recentPosts.length
              ? `最新${recentPosts.length}件 / 全${totalPostCount}件`
              : `全${totalPostCount}件`}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {recentPosts.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm text-zinc-500">投稿はありません。</div>
          ) : (
            recentPosts.map((post) => (
              <div key={post.id} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>{formatDate(post.createdAt)}</span>
                  <span>{post.deletedAt ? "削除済み" : post.isHidden ? "非表示" : "表示中"}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-zinc-800">
                  {shortText(post.content)}
                </p>
                {post.imageUrl && <div className="mt-2 text-xs text-zinc-500">画像あり</div>}
                {post.hiddenReason && (
                  <div className="mt-2 text-xs text-zinc-500">非表示理由: {post.hiddenReason}</div>
                )}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span>いいね {post._count.likes}</span>
                  <span>わかる {post.wakaruCount}</span>
                  <span>頑張った {post.ganbattaCount}</span>
                  {!post.deletedAt && (
                    <Link href={`/post?id=${post.id}`} className="text-[#1d9bf0] hover:underline">
                      投稿を開く
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">このユーザーへの通報</h2>
            <span className="text-xs text-zinc-500">
              {reportsTargetingCount > reportsTargetingUser.length
                ? `最新${reportsTargetingUser.length}件 / 全${reportsTargetingCount}件`
                : `全${reportsTargetingCount}件`}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {reportsTargetingUser.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-zinc-500">通報はありません。</div>
            ) : (
              reportsTargetingUser.map((report) => {
                const reporter = report.reporter.email ?? report.reporter.name ?? report.reporter.id;
                return (
                  <div key={report.id} className="rounded-lg border border-border p-4 text-sm">
                    <div className="font-semibold text-zinc-900">
                      {reasonLabels[report.reason]} / {statusLabels[report.status]}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatDate(report.createdAt)} / reporter: {reporter}
                    </div>
                    {report.detail && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-zinc-700">{report.detail}</p>
                    )}
                    {report.post && (
                      <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                        投稿: {shortText(report.post.content, 80)}
                        {report.post.isHidden ? " / 非表示" : ""}
                        {report.post.deletedAt ? " / 削除済み" : ""}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">このユーザーが送った通報</h2>
            <span className="text-xs text-zinc-500">
              {reportsMadeCount > reportsMade.length
                ? `最新${reportsMade.length}件 / 全${reportsMadeCount}件`
                : `全${reportsMadeCount}件`}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {reportsMade.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-zinc-500">通報はありません。</div>
            ) : (
              reportsMade.map((report) => {
                const target = report.targetUser.email ?? report.targetUser.name ?? report.targetUser.id;
                return (
                  <div key={report.id} className="rounded-lg border border-border p-4 text-sm">
                    <div className="font-semibold text-zinc-900">
                      {reasonLabels[report.reason]} / {statusLabels[report.status]}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatDate(report.createdAt)} / target: {target}
                    </div>
                    {report.detail && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-zinc-700">{report.detail}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900">監査ログ</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>
              {auditLogCount > auditLogs.length
                ? `最新${auditLogs.length}件 / 全${auditLogCount}件`
                : `全${auditLogCount}件`}
            </span>
            <Link
              href={`/admin/audit?q=${encodeURIComponent(user.id)}`}
              className="font-semibold text-[#1d9bf0] hover:underline"
            >
              監査ログで開く
            </Link>
          </div>
        </div>
        <div className="rounded-lg border border-border">
          {auditLogs.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">監査ログはありません。</div>
          ) : (
            <div className="divide-y divide-border">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-900">{log.action}</div>
                    <div className="text-xs text-zinc-500">{formatDate(log.createdAt)}</div>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    actor: {log.actorUser.email ?? log.actorUser.name ?? log.actorUser.id}
                  </div>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-50 p-2 text-xs text-zinc-600">
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
