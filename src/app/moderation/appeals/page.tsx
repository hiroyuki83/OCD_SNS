import Link from 'next/link';
import { Role, WarningAppealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAnyRole } from '@/lib/rbac';
import { reviewWarningAppeal } from './actions';

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
          role: true,
        },
      },
      reviewer: {
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
          revokedAt: true,
          actorUserId: true,
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
          警告に対する異議申立てを審査します。
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-1 text-xs font-semibold " +
                      (appeal.status === WarningAppealStatus.PENDING
                        ? "bg-zinc-100 text-zinc-700"
                        : appeal.status === WarningAppealStatus.UPHELD
                          ? "bg-amber-100 text-amber-800"
                          : "bg-green-100 text-green-800")
                    }
                  >
                    {appeal.status === WarningAppealStatus.PENDING
                      ? "未審査"
                      : appeal.status === WarningAppealStatus.UPHELD
                        ? "警告維持"
                        : "警告取消"}
                  </span>
                  {appeal.reviewedAt && (
                    <span className="text-xs text-zinc-500">
                      審査: {formatDate(appeal.reviewedAt)}
                    </span>
                  )}
                  {appeal.reviewer && (
                    <span className="text-xs text-zinc-500">
                      reviewer: {appeal.reviewer.name ?? `@${appeal.reviewer.handle}`}
                    </span>
                  )}
                </div>

                {appeal.resolutionNote && (
                  <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
                    <div className="text-xs font-semibold text-zinc-500">審査理由</div>
                    <div className="mt-1 whitespace-pre-wrap break-words">
                      {appeal.resolutionNote}
                    </div>
                  </div>
                )}

                {appeal.status === WarningAppealStatus.PENDING && (
                  <form className="mt-3 rounded-md border border-border p-3">
                    <label className="block text-xs font-semibold text-zinc-700">
                      審査理由
                      <textarea
                        name="note"
                        minLength={5}
                        maxLength={500}
                        required
                        rows={3}
                        className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
                        placeholder="判断理由を入力してください"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        formAction={reviewWarningAppeal.bind(
                          null,
                          appeal.id,
                          WarningAppealStatus.UPHELD,
                        )}
                        className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800"
                      >
                        警告を維持
                      </button>
                      <button
                        formAction={reviewWarningAppeal.bind(
                          null,
                          appeal.id,
                          WarningAppealStatus.OVERTURNED,
                        )}
                        className="rounded-full border border-green-300 px-3 py-1 text-xs font-semibold text-green-800"
                      >
                        警告を取り消す
                      </button>
                    </div>
                  </form>
                )}

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
