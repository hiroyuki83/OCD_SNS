import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountStatus, ReportReason, ReportStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import UserAccessPanel from "../UserAccessPanel";

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
  params: { id: string };
}) {
  await requireRole(Role.ADMIN);

  const userId = params.id;
  const [
    user,
    visiblePostCount,
    hiddenPostCount,
    openReports,
    reviewingReports,
    reportsMadeCount,
    followerCount,
    followingCount,
    recentPosts,
    reportsTargetingUser,
    reportsMade,
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
        suspendedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.post.count({ where: { authorId: userId, isHidden: false } }),
    prisma.post.count({ where: { authorId: userId, isHidden: true } }),
    prisma.report.count({ where: { targetUserId: userId, status: ReportStatus.OPEN } }),
    prisma.report.count({ where: { targetUserId: userId, status: ReportStatus.REVIEWING } }),
    prisma.report.count({ where: { reporterId: userId } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
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
        post: { select: { id: true, content: true, isHidden: true } },
      },
    }),
    prisma.report.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        targetUser: { select: { id: true, email: true, name: true } },
        post: { select: { id: true, content: true, isHidden: true } },
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

  const identity = user.email ?? user.name ?? user.id;
  const stats = [
    { label: "公開投稿", value: visiblePostCount, helper: "表示中の投稿" },
    { label: "非表示投稿", value: hiddenPostCount, helper: "モデレーション済み" },
    { label: "未対応通報", value: openReports, helper: `対応中 ${reviewingReports} 件` },
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
        <h2 className="mb-3 text-base font-semibold text-zinc-900">最近の投稿</h2>
        <div className="flex flex-col gap-3">
          {recentPosts.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm text-zinc-500">投稿はありません。</div>
          ) : (
            recentPosts.map((post) => (
              <div key={post.id} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>{formatDate(post.createdAt)}</span>
                  <span>{post.isHidden ? "非表示" : "表示中"}</span>
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
                  <Link href={`/post?id=${post.id}`} className="text-[#1d9bf0] hover:underline">
                    投稿を開く
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900">このユーザーへの通報</h2>
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
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-zinc-900">このユーザーが送った通報</h2>
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
        <h2 className="mb-3 text-base font-semibold text-zinc-900">監査ログ</h2>
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
