"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_OPTIONS = ["USER", "MODERATOR", "ADMIN"] as const;
const STATUS_OPTIONS = ["ACTIVE", "POST_RESTRICTED", "SUSPENDED"] as const;

type Role = (typeof ROLE_OPTIONS)[number];
type AccountStatus = (typeof STATUS_OPTIONS)[number];

const statusLabels: Record<AccountStatus, string> = {
  ACTIVE: "通常",
  POST_RESTRICTED: "投稿制限",
  SUSPENDED: "停止中",
};

type UserAccessPanelProps = {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: Role;
    status: AccountStatus;
    suspendedUntil: string | null;
  };
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

export default function UserAccessPanel({ user }: UserAccessPanelProps) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [savedRole, setSavedRole] = useState<Role>(user.role);
  const [selectedStatus, setSelectedStatus] = useState<AccountStatus>(user.status);
  const [savedStatus, setSavedStatus] = useState<AccountStatus>(user.status);
  const [pending, setPending] = useState<"role" | "status" | null>(null);

  const label = user.email ?? user.name ?? user.id;
  const roleChanged = selectedRole !== savedRole;
  const statusChanged = selectedStatus !== savedStatus;

  const updateRole = async () => {
    if (!roleChanged || pending) return;

    const confirmed = window.confirm(`${label} の権限を ${selectedRole} に変更しますか？`);
    if (!confirmed) return;

    setPending("role");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
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

      setSavedRole(selectedRole);
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  const updateStatus = async () => {
    if (!statusChanged || pending) return;

    const reason =
      selectedStatus === "ACTIVE"
        ? ""
        : window.prompt(`${label} を ${statusLabels[selectedStatus]}にする理由を入力してください。`) ?? null;
    if (reason === null) return;

    setPending("status");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, reason }),
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

      setSavedStatus(selectedStatus);
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">権限とアカウント状態</h2>
          <p className="mt-1 text-xs text-zinc-500">
            変更は監査ログに記録されます。停止は7日間として保存されます。
          </p>
        </div>
        {user.suspendedUntil && (
          <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            停止期限 {formatDate(user.suspendedUntil)}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md bg-zinc-50 p-3">
          <label className="block text-sm font-medium text-zinc-700">
            権限
            <select
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as Role)}
              disabled={pending !== null}
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
            onClick={updateRole}
            disabled={!roleChanged || pending !== null}
          >
            {pending === "role" ? "更新中" : "権限を更新"}
          </button>
        </div>

        <div className="rounded-md bg-zinc-50 p-3">
          <label className="block text-sm font-medium text-zinc-700">
            アカウント状態
            <select
              className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as AccountStatus)}
              disabled={pending !== null}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 disabled:text-zinc-400"
            onClick={updateStatus}
            disabled={!statusChanged || pending !== null}
          >
            {pending === "status" ? "更新中" : "状態を更新"}
          </button>
        </div>
      </div>
    </section>
  );
}
