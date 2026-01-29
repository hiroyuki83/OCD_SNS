import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";

const formatDate = (date: Date) =>
  date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

const getRoleChangeLabel = (action: string, meta: unknown) => {
  if (action !== "ROLE_CHANGE") return "-";
  if (!meta || typeof meta !== "object") return "-";
  const record = meta as Record<string, unknown>;
  const fromRole = typeof record.fromRole === "string" ? record.fromRole : null;
  const toRole = typeof record.toRole === "string" ? record.toRole : null;
  if (!fromRole || !toRole) return "-";
  return `${fromRole} → ${toRole}`;
};

const formatMeta = (meta: unknown) => {
  if (!meta) return "-";
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { action?: string };
}) {
  await requireRole(Role.ADMIN);

  const actionFilter = searchParams?.action?.trim();

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    where: actionFilter ? { action: actionFilter } : undefined,
    include: {
      actorUser: { select: { id: true, email: true } },
      targetUser: { select: { id: true, email: true } },
    },
  });

  const filters = [
    { label: "All", href: "/admin/audit" },
    { label: "ROLE_CHANGE", href: "/admin/audit?action=ROLE_CHANGE" },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">監査ログ</h1>
          <p className="text-sm text-zinc-500 mt-1">
            最新200件まで表示します。{actionFilter ? `（${actionFilter}）` : ""}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {filters.map((filter) => {
          const isActive =
            (!actionFilter && filter.label === "All") ||
            (actionFilter && filter.label === actionFilter);
          return (
            <a
              key={filter.label}
              href={filter.href}
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
          <div className="col-span-2">Role</div>
          <div className="col-span-2">Actor</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-2">Meta</div>
        </div>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <div className="px-4 py-6 text-sm text-zinc-500">ログがありません。</div>
          ) : (
            logs.map((log) => {
              const actorLabel = log.actorUser?.email ?? log.actorUserId;
              const targetLabel = log.targetUser?.email ?? log.targetUserId;
              const roleChangeLabel = getRoleChangeLabel(log.action, log.meta);
              return (
                <div key={log.id} className="grid grid-cols-12 items-start gap-2 px-4 py-3 text-sm">
                  <div className="col-span-2 text-zinc-600">{formatDate(log.createdAt)}</div>
                  <div className="col-span-2 font-medium text-zinc-900">{log.action}</div>
                  <div className="col-span-2 text-zinc-700">{roleChangeLabel}</div>
                  <div className="col-span-2 text-zinc-700 break-words">{actorLabel}</div>
                  <div className="col-span-2 text-zinc-700 break-words">{targetLabel}</div>
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
