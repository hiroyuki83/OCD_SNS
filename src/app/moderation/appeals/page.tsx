import Link from 'next/link';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';

const formatDate = (date: Date) =>
  date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

export default async function AppealListPage() {
  const actor = await requireAnyRole([Role.ADMIN, Role.MODERATOR]);

  const appeals = await prisma.warningAppeal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          name: true,
          email: true,
        },
      },
      warning: {
        select: {
          id: true,
          reason: true,
          createdAt: true,
          reportId: true,
        },
      },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/moderation" className="text-sm text-zinc-500 hover:text-zinc-900">
          モデレーションへ戻る
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">異議申立て</h1>
        <p className="mt-1 text-sm text-zinc-500">
          警告に対してユーザーから送信された異議申立てです。現在は閲覧のみです。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {appeals.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-zinc-500">
            異議申立てはありません。
          </div>
        ) : (
          appeals.map((appeal) => {
            const userLabel = appeal.user.name ?? `@${appeal.user.handle}`;

            return (
              <article key={appeal.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-900">{userLabel}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      @{appeal.user.handle}
                      {actor.role === Role.ADMIN ? ` / ${appeal.user.email}` : ''}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{formatDate(appeal.createdAt)}</div>
                </div>

                <div className="mt-3 rounded-md bg-zinc-50 p-3">
                  <div className="text-xs font-semibold text-zinc-500">元の警告</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800">
                    {appeal.warning.reason}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500">
                    警告日時: {formatDate(appeal.warning.createdAt)}
                    {appeal.warning.reportId ? ` / report: ${appeal.warning.reportId}` : ''}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-zinc-500">異議申立て内容</div>
                  <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-900">
                    {appeal.message}
                  </div>
                </div>

                {actor.role === Role.ADMIN && (
                  <div className="mt-3">
                    <Link
                      href={`/admin/users/${appeal.user.id}`}
                      className="text-xs font-semibold text-[#1d9bf0] hover:underline"
                    >
                      ユーザー詳細を開く
                    </Link>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
