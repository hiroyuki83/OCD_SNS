import Link from "next/link";

const ROLE_OPTIONS = ["USER", "MODERATOR", "ADMIN"] as const;
const STATUS_OPTIONS = ["ACTIVE", "POST_RESTRICTED", "SUSPENDED"] as const;
export type Role = (typeof ROLE_OPTIONS)[number];
export type AccountStatus = (typeof STATUS_OPTIONS)[number];

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  status: AccountStatus;
  suspendedUntil: string | null;
  createdAt: string;
};

const statusLabels: Record<AccountStatus, string> = {
  ACTIVE: "通常",
  POST_RESTRICTED: "投稿制限",
  SUSPENDED: "停止中",
};

const statusClasses: Record<AccountStatus, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  POST_RESTRICTED: "bg-amber-50 text-amber-700",
  SUSPENDED: "bg-red-50 text-red-700",
};

const roleClasses: Record<Role, string> = {
  USER: "bg-zinc-100 text-zinc-700",
  MODERATOR: "bg-blue-50 text-blue-700",
  ADMIN: "bg-violet-50 text-violet-700",
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

export default function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500">
        <div className="col-span-3">ユーザー</div>
        <div className="col-span-3">メール</div>
        <div className="col-span-2">作成日</div>
        <div className="col-span-1">権限</div>
        <div className="col-span-2">状態</div>
        <div className="col-span-1 text-right">管理</div>
      </div>
      <div className="divide-y divide-border">
        {users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">
            条件に一致するユーザーはありません。
          </div>
        ) : (
          users.map((user) => (
            <div key={user.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
              <div className="col-span-3 min-w-0">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {user.name ?? "(no name)"}
                </Link>
                <div className="truncate text-xs text-zinc-500">{user.id}</div>
              </div>
              <div className="col-span-3 truncate pr-3 text-zinc-700">{user.email ?? "-"}</div>
              <div className="col-span-2 text-xs text-zinc-500">{formatDate(user.createdAt)}</div>
              <div className="col-span-1">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${roleClasses[user.role]}`}>
                  {user.role}
                </span>
              </div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[user.status]}`}>
                  {statusLabels[user.status]}
                </span>
                {user.suspendedUntil && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    期限 {formatDate(user.suspendedUntil)}
                  </div>
                )}
              </div>
              <div className="col-span-1 text-right">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                >
                  詳細
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
