import { AccountStatus, Prisma, Role } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import UsersTable from "./UsersTable";
import PaginationLinks from "@/components/shared/PaginationLinks";
import { normalizeSearchQuery } from "@/lib/searchInput";
import { clampPage, parsePageNumber } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const roleOptions = [Role.USER, Role.MODERATOR, Role.ADMIN] as const;
const statusOptions = [AccountStatus.ACTIVE, AccountStatus.POST_RESTRICTED, AccountStatus.SUSPENDED] as const;

function selectedRole(value?: string) {
  return roleOptions.find((role) => role === value) ?? null;
}

function selectedStatus(value?: string) {
  return statusOptions.find((status) => status === value) ?? null;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string; status?: string; page?: string };
}) {
  await requireRole(Role.ADMIN);

  const normalizedQuery = normalizeSearchQuery(searchParams?.q ?? "");
  const query = normalizedQuery.ok ? normalizedQuery.value : "";
  const roleFilter = selectedRole(searchParams?.role);
  const statusFilter = selectedStatus(searchParams?.status);
  const filters: Prisma.UserWhereInput[] = [];

  if (query) {
    filters.push({
      OR: [
        { id: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
      ],
    });
  }
  if (roleFilter) {
    filters.push({ role: roleFilter });
  }
  if (statusFilter) {
    filters.push({ status: statusFilter });
  }

  const where: Prisma.UserWhereInput | undefined = filters.length ? { AND: filters } : undefined;

  const [totalCount, filteredCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where }),
  ]);

  const pagination = clampPage(
    parsePageNumber(searchParams?.page),
    filteredCount,
    100,
  );

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      suspendedUntil: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
  });

  const viewUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    suspendedUntil: user.suspendedUntil?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ユーザー管理</h1>
          <p className="mt-1 text-sm text-zinc-500">
            一覧は閲覧専用です。権限・状態の変更は各ユーザーの詳細画面で再認証して実行します。
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          ユーザーを作成
        </Link>
      </div>

      <form className="mb-4 rounded-lg border border-border p-4" action="/admin/users">
        <div className="grid gap-3 xl:grid-cols-12">
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-6">
            検索
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="名前、メール、ユーザーID"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            権限
            <select
              name="role"
              defaultValue={roleFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700 xl:col-span-2">
            状態
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              絞り込み
            </button>
            <Link
              href="/admin/users"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700 hover:text-zinc-900"
            >
              解除
            </Link>
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          {filteredCount === 0
            ? "0件"
            : `${pagination.skip + 1}〜${Math.min(
                pagination.skip + users.length,
                filteredCount,
              )}件目`} / 絞り込み {filteredCount}件 / 全 {totalCount}件
        </div>
      </form>

      <UsersTable users={viewUsers} />

      {filteredCount > 0 && (
        <PaginationLinks
          page={pagination.page}
          totalPages={pagination.totalPages}
          previousHref={
            pagination.hasPrevious
              ? (() => {
                  const params = new URLSearchParams();
                  if (query) params.set("q", query);
                  if (roleFilter) params.set("role", roleFilter);
                  if (statusFilter) params.set("status", statusFilter);
                  params.set("page", String(pagination.page - 1));
                  return `/admin/users?${params.toString()}`;
                })()
              : null
          }
          nextHref={
            pagination.hasNext
              ? (() => {
                  const params = new URLSearchParams();
                  if (query) params.set("q", query);
                  if (roleFilter) params.set("role", roleFilter);
                  if (statusFilter) params.set("status", statusFilter);
                  params.set("page", String(pagination.page + 1));
                  return `/admin/users?${params.toString()}`;
                })()
              : null
          }
        />
      )}
    </div>
  );
}
