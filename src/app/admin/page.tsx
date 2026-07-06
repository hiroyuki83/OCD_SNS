import Link from "next/link";
import { AccountStatus, ReportStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

export default async function AdminIndexPage() {
  await requireRole(Role.ADMIN);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const now = new Date();

  const [
    userCount,
    postCount,
    todayPostCount,
    openReportCount,
    reviewingReportCount,
    hiddenPostCount,
    restrictedUserCount,
    suspendedUserCount,
    activeAnnouncementCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count({ where: { isHidden: false } }),
    prisma.post.count({ where: { createdAt: { gte: startOfToday }, isHidden: false } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.report.count({ where: { status: ReportStatus.REVIEWING } }),
    prisma.post.count({ where: { isHidden: true } }),
    prisma.user.count({ where: { status: AccountStatus.POST_RESTRICTED } }),
    prisma.user.count({ where: { status: AccountStatus.SUSPENDED } }),
    prisma.announcement.count({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    }),
  ]);

  const stats = [
    { label: "ユーザー", value: userCount, helper: "登録済みアカウント" },
    { label: "公開投稿", value: postCount, helper: `本日 ${todayPostCount} 件` },
    { label: "未対応通報", value: openReportCount, helper: `対応中 ${reviewingReportCount} 件` },
    { label: "非表示投稿", value: hiddenPostCount, helper: "モデレーション済み" },
    { label: "投稿制限", value: restrictedUserCount, helper: "制限中ユーザー" },
    { label: "停止中", value: suspendedUserCount, helper: "アカウント停止" },
    { label: "公開お知らせ", value: activeAnnouncementCount, helper: "ホームに表示中" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">管理トップ</h1>
        <p className="text-sm text-zinc-500 mt-1">運用状況を確認し、必要な管理メニューへ移動できます。</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-4">
            <div className="text-sm font-medium text-zinc-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-900">{stat.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{stat.helper}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="border border-border rounded-xl p-4 hover:bg-zinc-50 transition-colors"
        >
          <div className="text-lg font-semibold text-zinc-900">Users</div>
          <div className="text-sm text-zinc-500 mt-1">ユーザー権限の管理</div>
        </Link>
        <Link
          href="/admin/audit"
          className="border border-border rounded-xl p-4 hover:bg-zinc-50 transition-colors"
        >
          <div className="text-lg font-semibold text-zinc-900">Audit logs</div>
          <div className="text-sm text-zinc-500 mt-1">監査ログの確認</div>
        </Link>
        <Link
          href="/moderation"
          className="border border-border rounded-xl p-4 hover:bg-zinc-50 transition-colors"
        >
          <div className="text-lg font-semibold text-zinc-900">Moderation</div>
          <div className="text-sm text-zinc-500 mt-1">通報、投稿非表示、ユーザー制限</div>
        </Link>
        <Link
          href="/admin/announcements"
          className="border border-border rounded-xl p-4 hover:bg-zinc-50 transition-colors"
        >
          <div className="text-lg font-semibold text-zinc-900">Announcements</div>
          <div className="text-sm text-zinc-500 mt-1">運営からのお知らせを管理</div>
        </Link>
      </div>
    </div>
  );
}
