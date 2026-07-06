import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const formatDate = (date: Date) =>
  date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

const getRoleChangeLabel = (action: string, meta: unknown) => {
  if (!meta || typeof meta !== "object") return "-";
  const record = meta as Record<string, unknown>;
  if (action === "USER_STATUS_CHANGE") {
    const fromStatus = typeof record.fromStatus === "string" ? record.fromStatus : null;
    const toStatus = typeof record.toStatus === "string" ? record.toStatus : null;
    if (!fromStatus || !toStatus) return "-";
    return `${fromStatus} -> ${toStatus}`;
  }
  if (action !== "ROLE_CHANGE") return "-";
  const fromRole = typeof record.fromRole === "string" ? record.fromRole : null;
  const toRole = typeof record.toRole === "string" ? record.toRole : null;
  if (!fromRole || !toRole) return "-";
  return `${fromRole} -> ${toRole}`;
};

const formatMeta = (meta: unknown) => {
  if (!meta) return "-";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
};

const actionOptions = [
  "ROLE_CHANGE",
  "USER_STATUS_CHANGE",
  "POST_HIDE",
  "POST_RESTORE",
  "REPORT_REVIEWING",
  "REPORT_RESOLVE",
  "REPORT_REJECT",
  "ANNOUNCEMENT_CREATE",
  "ANNOUNCEMENT_STATUS",
] as const;

function selectedAction(value?: string) {
  return actionOptions.find((action) => action === value) ?? null;
}

function auditHref(action: string | null, query: string) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (query) params.set("q", query);
  const suffix = params.toString();
  return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string; q?: string };
}) {
  await requireRole(Role.ADMIN);

  const query = searchParams?.q?.trim() ?? "";
  const actionFilter = selectedAction(searchParams?.action);
  const filters: Prisma.AuditLogWhereInput[] = [];

  if (actionFilter) {
    filters.push({ action: actionFilter });
  }

  let matchingUserIds: string[] = [];
  if (query) {
    const matchingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: { contains: query } },
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    matchingUserIds = matchingUsers.map((user) => user.id);

    filters.push({
      OR: [
        { action: { contains: query, mode: "insensitive" } },
        { actorUserId: { contains: query } },
        { targetUserId: { contains: query } },
        ...(matchingUserIds.length
          ? [
              { actorUserId: { in: matchingUserIds } },
              { targetUserId: { in: matchingUserIds } },
            ]
          : []),
      ],
    });
  }

  const where: Prisma.AuditLogWhereInput | undefined = filters.length ? { AND: filters } : undefined;

  const [logs, totalCount, filteredCount] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      where,
      include: {
        actorUser: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.auditLog.count(),
    prisma.auditLog.count({ where }),
  ]);

  const filtersNav = [
    { label: "All", action: null },
    ...actionOptions.map((action) => ({ label: action, action })),
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">監査ログ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            最新200件まで表示します。{filteredCount} / {totalCount} 件
          </p>
        </div>
      </div>

      <form className="mb-4 rounded-lg border border-border p-4" action="/admin/audit">
        <div className="grid gap-3 xl:grid-cols-12">
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-7">
            検索
            <input
              name="q"
              defaultValue={query}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Action、actor/targetの名前・メール・ユーザーID"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-3">
            Action
            <select
              name="action"
              defaultValue={actionFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              絞り込み
            </button>
            <a
              href="/admin/audit"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              解除
            </a>
          </div>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {filtersNav.map((filter) => {
          const isActive =
            (!actionFilter && filter.action === null) ||
            (actionFilter && filter.action === actionFilter);
          return (
            <a
              key={filter.label}
              href={auditHref(filter.action, query)}
              className={
                "px-3 py-1 rounded-full text-xs font-semibold border transition-colors " +
                (isActive
                  ? "bg-black text-white border-black"
                  : "text-zinc-600 border-border hover:text-zinc-900")
              }
            >
              {filter.label}
            </a>
          );
        })}
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500">
          <div className="col-span-2">日時</div>
          <div className="col-span-2">Action</div>
          <div className="col-span-2">Change</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-2">Meta</div>
        </div>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">条件に一致するログはありません。</div>
          ) : (
            logs.map((log) => {
              const actorLabel = log.actorUser?.email ?? log.actorUser?.name ?? log.actorUserId;
              const targetLabel = log.targetUser?.email ?? log.targetUser?.name ?? log.targetUserId;
              const roleChangeLabel = getRoleChangeLabel(log.action, log.meta);
              return (
                <div key={log.id} className="grid grid-cols-12 items-start gap-2 px-4 py-3 text-sm">
                  <div className="col-span-2 text-zinc-600">{formatDate(log.createdAt)}</div>
                  <div className="col-span-2 font-medium text-zinc-900">{log.action}</div>
                  <div className="col-span-2 text-zinc-700">{roleChangeLabel}</div>
                  <div className="col-span-2 break-words text-zinc-700">
                    <div>{actorLabel}</div>
                    <div className="text-xs text-zinc-500">{log.actorUserId}</div>
                  </div>
                  <div className="col-span-2 break-words text-zinc-700">
                    <div>{targetLabel}</div>
                    <div className="text-xs text-zinc-500">{log.targetUserId}</div>
                  </div>
                  <div className="col-span-2">
                    <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-words max-h-24 overflow-auto">
                      {formatMeta(log.meta)}
                    </pre>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
