import Link from "next/link";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/rbac";

export default async function AdminIndexPage() {
  await requireRole(Role.ADMIN);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">管理トップ</h1>
        <p className="text-sm text-zinc-500 mt-1">管理メニューを選択してください。</p>
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
      </div>
    </div>
  );
}
