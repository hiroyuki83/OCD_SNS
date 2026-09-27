import Link from 'next/link';
import { AccountStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';

export const dynamic = 'force-dynamic';

const formatDate = (date: Date | null) =>
  date
    ? date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '-';

export default async function StaffSecurityPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string; mfa?: string; page?: string };
}) {
  await requireRole(Role.ADMIN);

  const normalizedQuery = normalizeSearchQuery(searchParams?.q ?? '');
  const query = normalizedQuery.ok ? normalizedQuery.value : '';
  const roleFilter =
    searchParams?.role === Role.ADMIN || searchParams?.role === Role.MODERATOR
      ? searchParams.role
      : null;
  const mfaFilter =
    searchParams?.mfa === 'enabled' || searchParams?.mfa === 'missing'
      ? searchParams.mfa
      : null;

  const filters: Prisma.UserWhereInput[] = [
    { role: { in: [Role.ADMIN, Role.MODERATOR] } },
  ];
  if (roleFilter) filters.push({ role: roleFilter });
  if (mfaFilter === 'enabled') filters.push({ staffTotpEnabledAt: { not: null } });
  if (mfaFilter === 'missing') filters.push({ staffTotpEnabledAt: null });
  if (query) {
    const handleQuery = query.replace(/^@/, '');
    filters.push({
      OR: [
        { id: { contains: query } },
        { email: { contains: query, mode: 'insensitive' } },
        { handle: { contains: handleQuery, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    });
  }

  const where: Prisma.UserWhereInput = { AND: filters };

  const [staffCount, enabledCount, filteredCount] = await Promise.all([
    prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.MODERATOR] } } }),
    prisma.user.count({
      where: {
        role: { in: [Role.ADMIN, Role.MODERATOR] },
        staffTotpEnabledAt: { not: null },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const pagination = clampPage(
    parsePageNumber(searchParams?.page),
    filteredCount,
    100,
  );

  const staff = await prisma.user.findMany({
      where,
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      skip: pagination.skip,
      take: pagination.pageSize,
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        status: true,
        suspendedUntil: true,
        staffTotpEnabledAt: true,
        _count: {
          select: {
            staffRecoveryCodes: {
              where: { usedAt: null },
            },
          },
        },
      },
    });

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-900">
          管理トップへ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">スタッフセキュリティ</h1>
        <p className="mt-1 text-sm text-zinc-500">
          ADMIN / MODERATOR の2段階認証状態を確認します。秘密鍵やリカバリーコード本文は表示しません。
        </p>
      </div>

      <form action="/admin/staff-security" className="mb-5 rounded-lg border border-border p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm font-medium text-zinc-700 md:col-span-2">
            検索
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              placeholder="名前、@handle、メール、ユーザーID"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            権限
            <select
              name="role"
              defaultValue={roleFilter ?? ''}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              <option value={Role.ADMIN}>ADMIN</option>
              <option value={Role.MODERATOR}>MODERATOR</option>
            </select>
          </label>
          <label className="text-sm font-medium text-zinc-700">
            MFA
            <select
              name="mfa"
              defaultValue={mfaFilter ?? ''}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              <option value="enabled">設定済み</option>
              <option value="missing">未設定</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            {filteredCount === 0
              ? '0件'
              : `${pagination.skip + 1}〜${Math.min(
                  pagination.skip + staff.length,
                  filteredCount,
                )}件目 / 絞り込み ${filteredCount}件`}
          </div>
          <div className="flex gap-2">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              絞り込み
            </button>
            <Link
              href="/admin/staff-security"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              解除
            </Link>
          </div>
        </div>
      </form>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-zinc-500">スタッフ</div>
          <div className="mt-1 text-2xl font-semibold">{staffCount}</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-zinc-500">MFA設定済み</div>
          <div className="mt-1 text-2xl font-semibold">{enabledCount}</div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="text-sm text-zinc-500">MFA未設定</div>
          <div className="mt-1 text-2xl font-semibold">{staffCount - enabledCount}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">スタッフ</th>
              <th className="px-4 py-3">権限</th>
              <th className="px-4 py-3">状態</th>
              <th className="px-4 py-3">2段階認証</th>
              <th className="px-4 py-3">有効化日時</th>
              <th className="px-4 py-3">未使用リカバリーコード</th>
              <th className="px-4 py-3">管理</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((user) => {
              const mfaEnabled = Boolean(user.staffTotpEnabledAt);
              const recoveryCount = user._count.staffRecoveryCodes;
              return (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">
                      {user.name ?? `@${user.handle}`}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      @{user.handle} / {user.email}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{user.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'rounded-full px-2 py-1 text-xs font-semibold ' +
                        (user.status === AccountStatus.ACTIVE
                          ? 'bg-green-100 text-green-700'
                          : user.status === AccountStatus.POST_RESTRICTED
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700')
                      }
                    >
                      {user.status}
                    </span>
                    {user.status === AccountStatus.SUSPENDED && user.suspendedUntil && (
                      <div className="mt-1 text-[11px] text-zinc-500">
                        期限 {formatDate(user.suspendedUntil)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'rounded-full px-2 py-1 text-xs font-semibold ' +
                        (mfaEnabled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700')
                      }
                    >
                      {mfaEnabled ? '設定済み' : '未設定'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">
                    {formatDate(user.staffTotpEnabledAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        'font-semibold ' +
                        (mfaEnabled && recoveryCount <= 2
                          ? 'text-red-700'
                          : 'text-zinc-800')
                      }
                    >
                      {mfaEnabled ? recoveryCount : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-xs font-semibold text-[#1d9bf0] hover:underline"
                    >
                      ユーザー詳細
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredCount > 0 && (
        <PaginationLinks
          page={pagination.page}
          totalPages={pagination.totalPages}
          previousHref={
            pagination.hasPrevious
              ? (() => {
                  const params = new URLSearchParams();
                  if (query) params.set('q', query);
                  if (roleFilter) params.set('role', roleFilter);
                  if (mfaFilter) params.set('mfa', mfaFilter);
                  params.set('page', String(pagination.page - 1));
                  return `/admin/staff-security?${params.toString()}`;
                })()
              : null
          }
          nextHref={
            pagination.hasNext
              ? (() => {
                  const params = new URLSearchParams();
                  if (query) params.set('q', query);
                  if (roleFilter) params.set('role', roleFilter);
                  if (mfaFilter) params.set('mfa', mfaFilter);
                  params.set('page', String(pagination.page + 1));
                  return `/admin/staff-security?${params.toString()}`;
                })()
              : null
          }
        />
      )}
    </div>
  );
}
