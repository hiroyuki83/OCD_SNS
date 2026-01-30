"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = ["USER", "MODERATOR", "ADMIN"] as const;
export type Role = (typeof ROLE_OPTIONS)[number];

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
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

  const [selectedRoles, setSelectedRoles] = useState<Record<string, Role>>(initialRoles);
  const [savedRoles, setSavedRoles] = useState<Record<string, Role>>(initialRoles);
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

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-12 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-500">
        <div className="col-span-4">ユーザー</div>
        <div className="col-span-3">メール</div>
        <div className="col-span-2">作成日</div>
        <div className="col-span-3">権限</div>
      </div>
      <div className="divide-y divide-border">
        {users.map((user) => {
          const selectedRole = selectedRoles[user.id] ?? user.role;
          const savedRole = savedRoles[user.id] ?? user.role;
          const hasChanges = selectedRole !== savedRole;
          const isPending = pendingId === user.id;

          return (
            <div key={user.id} className="grid grid-cols-12 items-center px-4 py-3 text-sm">
              <div className="col-span-4">
                <div className="font-medium text-zinc-900">{user.name ?? "(no name)"}</div>
                <div className="text-xs text-zinc-500">{user.id}</div>
              </div>
              <div className="col-span-3 text-zinc-700">{user.email ?? "-"}</div>
              <div className="col-span-2 text-zinc-500">{formatDate(user.createdAt)}</div>
              <div className="col-span-3 flex items-center gap-2">
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
                  disabled={!hasChanges || isPending}
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

