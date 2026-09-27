import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { createAnnouncement, setAnnouncementActive, updateAnnouncement } from './actions';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { formatTokyoDateTimeLocal } from '@/lib/tokyoDateTime';

export const dynamic = 'force-dynamic';

const formatDate = (date: Date | null) =>
  date ? date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '指定なし';

function isVisibleNow(announcement: {
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}) {
  const now = new Date();
  return (
    announcement.isActive &&
    (!announcement.startsAt || announcement.startsAt <= now) &&
    (!announcement.endsAt || announcement.endsAt >= now)
  );
}

function announcementHref(query: string, state: string, page = 1) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (state) params.set('state', state);
  if (page > 1) params.set('page', String(page));
  const suffix = params.toString();
  return suffix ? `/admin/announcements?${suffix}` : '/admin/announcements';
}

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams?: { q?: string; state?: string; page?: string };
}) {
  await requireRole(Role.ADMIN);

  const normalizedQuery = normalizeSearchQuery(searchParams?.q ?? '');
  const query = normalizedQuery.ok ? normalizedQuery.value : '';
  const stateFilter =
    searchParams?.state === 'active' || searchParams?.state === 'inactive'
      ? searchParams.state
      : '';
  const filters: Prisma.AnnouncementWhereInput[] = [];
  if (query) {
    filters.push({
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
      ],
    });
  }
  if (stateFilter === 'active') filters.push({ isActive: true });
  if (stateFilter === 'inactive') filters.push({ isActive: false });
  const where: Prisma.AnnouncementWhereInput | undefined =
    filters.length > 0 ? { AND: filters } : undefined;

  const [announcementCount, totalAnnouncementCount] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.count(),
  ]);
  const pagination = clampPage(
    parsePageNumber(searchParams?.page),
    announcementCount,
    50,
  );
  const announcements = await prisma.announcement.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      createdBy: { select: { email: true, name: true } },
    },
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">お知らせ管理</h1>
        <p className="mt-1 text-sm text-zinc-500">
          公開中のお知らせはホームのフィード上部に表示されます。日時は日本時間（JST）で指定してください。
        </p>
      </div>

      <form action={createAnnouncement} className="mb-6 rounded-lg border border-border p-4">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700">
            タイトル
            <input
              name="title"
              required
              maxLength={80}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="例: メンテナンスのお知らせ"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            リンク
            <input
              name="href"
              type="url"
              maxLength={2048}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="https://..."
            />
          </label>
        </div>

        <label className="mb-4 block text-sm font-medium text-zinc-700">
          本文
          <textarea
            name="body"
            required
            maxLength={600}
            rows={4}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="ユーザーに知らせたい内容を入力してください。"
          />
        </label>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-zinc-700">
            開始日時（JST）
            <input
              name="startsAt"
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            終了日時（JST）
            <input
              name="endsAt"
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
            すぐ公開する
          </label>
          <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
            作成
          </button>
        </div>
      </form>

      <form action="/admin/announcements" className="mb-5 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <label className="text-sm font-medium text-zinc-700">
            検索
            <input
              name="q"
              defaultValue={query}
              maxLength={100}
              placeholder="タイトル・本文"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-zinc-700">
            公開設定
            <select
              name="state"
              defaultValue={stateFilter}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="">すべて</option>
              <option value="active">公開設定ON</option>
              <option value="inactive">非公開</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              絞り込み
            </button>
            <a
              href="/admin/announcements"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              解除
            </a>
          </div>
        </div>
        <div className="mt-3 text-xs text-zinc-500">
          {announcementCount === 0
            ? '0件'
            : `${pagination.skip + 1}〜${Math.min(
                pagination.skip + announcements.length,
                announcementCount,
              )}件目 / 絞り込み ${announcementCount}件 / 全 ${totalAnnouncementCount}件`}
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {announcements.length === 0 ? (
          <div className="rounded-lg border border-border p-6 text-center text-sm text-zinc-500">
            お知らせはまだありません。
          </div>
        ) : (
          announcements.map((announcement) => {
            const visibleNow = isVisibleNow(announcement);
            return (
              <div key={announcement.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-zinc-900">{announcement.title}</h2>
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                          (visibleNow
                            ? 'bg-green-100 text-green-700'
                            : announcement.isActive
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-zinc-100 text-zinc-600')
                        }
                      >
                        {visibleNow ? '公開中' : announcement.isActive ? '予約/期間外' : '非公開'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      作成: {formatDate(announcement.createdAt)} / 作成者:{' '}
                      {announcement.createdBy.email ?? announcement.createdBy.name ?? '-'}
                    </div>
                  </div>
                  <form action={setAnnouncementActive.bind(null, announcement.id, !announcement.isActive)}>
                    <button className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                      {announcement.isActive ? '非公開にする' : '公開する'}
                    </button>
                  </form>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
                  {announcement.body}
                </p>
                {announcement.href && (
                  <a
                    href={announcement.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-[#1d9bf0] hover:underline"
                  >
                    リンクを開く
                  </a>
                )}

                <div className="mt-3 text-xs text-zinc-500">
                  表示期間: {formatDate(announcement.startsAt)} から {formatDate(announcement.endsAt)} まで
                </div>

                <details className="mt-4 rounded-md border border-border p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                    内容を編集
                  </summary>
                  <form
                    action={updateAnnouncement.bind(
                      null,
                      announcement.id,
                      announcement.updatedAt.toISOString(),
                    )}
                    className="mt-3 space-y-3"
                  >
                    <label className="block text-xs font-semibold text-zinc-700">
                      タイトル
                      <input
                        name="title"
                        required
                        maxLength={80}
                        defaultValue={announcement.title}
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-zinc-700">
                      本文
                      <textarea
                        name="body"
                        required
                        maxLength={600}
                        rows={4}
                        defaultValue={announcement.body}
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-zinc-700">
                      リンク
                      <input
                        name="href"
                        type="url"
                        maxLength={2048}
                        defaultValue={announcement.href ?? ''}
                        className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-zinc-700">
                        開始日時（JST）
                        <input
                          name="startsAt"
                          type="datetime-local"
                          defaultValue={formatTokyoDateTimeLocal(announcement.startsAt)}
                          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-zinc-700">
                        終了日時（JST）
                        <input
                          name="endsAt"
                          type="datetime-local"
                          defaultValue={formatTokyoDateTimeLocal(announcement.endsAt)}
                          className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                    <button className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white">
                      変更を保存
                    </button>
                  </form>
                </details>
              </div>
            );
          })
        )}
      </div>
      {announcementCount > 0 && (
        <PaginationLinks
          page={pagination.page}
          totalPages={pagination.totalPages}
          previousHref={
            pagination.hasPrevious
              ? announcementHref(query, stateFilter, pagination.page - 1)
              : null
          }
          nextHref={
            pagination.hasNext
              ? announcementHref(query, stateFilter, pagination.page + 1)
              : null
          }
        />
      )}
    </div>
  );
}
