import Link from 'next/link';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const formatDate = (date: Date | null) =>
  date
    ? date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : '-';

export default async function StaffSecurityPage() {
  await requireRole(Role.ADMIN);

  const [staff, staffCount, enabledCount] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.MODERATOR] } },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
      take: 200,
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        staffTotpEnabledAt: true,
        _count: {
          select: {
            staffRecoveryCodes: {
              where: { usedAt: null },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { role: { in: [Role.ADMIN, Role.MODERATOR] } } }),
    prisma.user.count({
      where: {
        role: { in: [Role.ADMIN, Role.MODERATOR] },
        staffTotpEnabledAt: { not: null },
      },
    }),
  ]);

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

      {staffCount > staff.length && (
        <div className="mb-3 text-xs text-zinc-500">
          一覧は先頭200件を表示しています。
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">スタッフ</th>
              <th className="px-4 py-3">権限</th>
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
    </div>
  );
}
