"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
};

export default function UsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const initialRoles = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user.role])),
    [users],
  );
  const initialStatuses = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user.status])),
    [users],
  );

  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>(initialRoles);
  const [savedRoles, setSavedRoles] = useState<Record<string, Role>>(initialRoles);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<string, AccountStatus>>(initialStatuses);
  const [savedStatuses, setSavedStatuses] = useState<Record<string, AccountStatus>>(initialStatuses);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const updateRole = async (user: UserRow) => {
    const nextRole = selectedRoles[user.id];
    if (!nextRole || nextRole === savedRoles[user.id]) return;

    const label = user.email ?? user.name ?? user.id;
    const confirmed = window.confirm(`${label} の権限を ${nextRole} に変更しますか？`);
    if (!confirmed) return;

    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });

      if (!res.ok) {
        let message = "権限の更新に失敗しました。";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        alert(message);
        return;
      }

      setSavedRoles((prev) => ({ ...prev, [user.id]: nextRole }));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const updateStatus = async (user: UserRow) => {
    const nextStatus = selectedStatuses[user.id];
    if (!nextStatus || nextStatus === savedStatuses[user.id]) return;

    const label = user.email ?? user.name ?? user.id;
    const reason = nextStatus === "ACTIVE" ? "" : window.prompt(`${label} を ${nextStatus} にする理由を入力してください。`) ?? null;
    if (reason === null) return;

    setPendingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });

      if (!res.ok) {
        let message = "状態の更新に失敗しました。";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        alert(message);
        return;
      }

      setSavedStatuses((prev) => ({ ...prev, [user.id]: nextStatus }));
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500">
        <div className="col-span-3">ユーザー</div>
        <div className="col-span-3">メール</div>
        <div className="col-span-2">作成日</div>
        <div className="col-span-2">権限</div>
        <div className="col-span-2">状態</div>
      </div>
      <div className="divide-y divide-border">
        {users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-zinc-500">
            条件に一致するユーザーはありません。
          </div>
        ) : users.map((user) => {
          const selectedRole = selectedRoles[user.id] ?? user.role;
          const savedRole = savedRoles[user.id] ?? user.role;
          const selectedStatus = selectedStatuses[user.id] ?? user.status;
          const savedStatus = savedStatuses[user.id] ?? user.status;
          const hasRoleChanges = selectedRole !== savedRole;
          const hasStatusChanges = selectedStatus !== savedStatus;
          const isPending = pendingId === user.id;

          return (
            <div key={user.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
              <div className="col-span-3">
                <Link
                  href={`/admin/users/${user.id}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {user.name ?? "(no name)"}
                </Link>
                <div className="text-xs text-zinc-500">{user.id}</div>
              </div>
              <div className="col-span-3 text-zinc-700">{user.email ?? "-"}</div>
              <div className="col-span-2 text-zinc-500">{formatDate(user.createdAt)}</div>
              <div className="col-span-2 flex items-center gap-2">
                <select
                  className="border border-border rounded-md px-2 py-1 text-sm"
                  value={selectedRole}
                  onChange={(event) =>
                    setSelectedRoles((prev) => ({
                      ...prev,
                      [user.id]: event.target.value as Role,
                    }))
                  }
                  disabled={isPending}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs font-semibold px-3 py-1 rounded-full bg-black text-white disabled:bg-zinc-400"
                  onClick={() => updateRole(user)}
                  disabled={!hasRoleChanges || isPending}
                >
                  {isPending ? "更新中" : "更新"}
                </button>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <div>
                  <select
                    className="border border-border rounded-md px-2 py-1 text-sm"
                    value={selectedStatus}
                    onChange={(event) =>
                      setSelectedStatuses((prev) => ({
                        ...prev,
                        [user.id]: event.target.value as AccountStatus,
                      }))
                    }
                    disabled={isPending}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {user.suspendedUntil && (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      until {formatDate(user.suspendedUntil)}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold px-3 py-1 rounded-full border border-border disabled:text-zinc-400"
                  onClick={() => updateStatus(user)}
                  disabled={!hasStatusChanges || isPending}
                >
                  {isPending ? "更新中" : "更新"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

