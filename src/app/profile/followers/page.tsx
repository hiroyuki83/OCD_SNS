import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import {
    AcceptFollowForm,
    RejectFollowForm,
    RemoveFollowerForm,
} from '@/components/profile/ProfileRelationActions';
import { visibleAccountFilter } from '@/lib/accountStatus';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export default async function FollowersPage({
    searchParams,
}: {
    searchParams?: { page?: string; pendingPage?: string };
}) {
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    if (!session?.user || !userId) {
        return (
            <div className="p-6 text-sm text-zinc-400">
                フォロワーを見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const now = new Date();
    const acceptedWhere = {
        followingId: userId,
        acceptedAt: { not: null },
        follower: visibleAccountFilter(now),
    };
    const pendingWhere = {
        followingId: userId,
        acceptedAt: null,
        follower: visibleAccountFilter(now),
    };

    const [followerCount, pendingRequestCount] = await Promise.all([
        prisma.follow.count({ where: acceptedWhere }),
        prisma.follow.count({ where: pendingWhere }),
    ]);

    const acceptedPagination = clampPage(
        parsePageNumber(searchParams?.page),
        followerCount,
        50,
    );
    const pendingPagination = clampPage(
        parsePageNumber(searchParams?.pendingPage),
        pendingRequestCount,
        50,
    );

    const [followers, pendingRequests] = await Promise.all([
        prisma.follow.findMany({
            where: acceptedWhere,
            select: {
                id: true,
                acceptedAt: true,
                follower: {
                    select: {
                        id: true,
                        handle: true,
                        name: true,
                        bio: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: acceptedPagination.skip,
            take: acceptedPagination.pageSize,
        }),
        prisma.follow.findMany({
            where: pendingWhere,
            select: {
                id: true,
                createdAt: true,
                follower: {
                    select: {
                        id: true,
                        handle: true,
                        name: true,
                        bio: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: pendingPagination.skip,
            take: pendingPagination.pageSize,
        }),
    ]);

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center justify-between px-4">
                <h1 className="font-bold text-base">
                    フォロワー {followerCount}
                    {pendingRequestCount > 0 ? `（承認待ち ${pendingRequestCount}）` : ''}
                </h1>
                <Link href="/profile" className="text-xs text-[#1d9bf0] hover:underline">
                    プロフィールへ戻る
                </Link>
            </div>

            {pendingRequestCount > 0 && (
                <section className="border-b border-border">
                    <div className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        承認待ち {pendingRequestCount}件・{pendingPagination.page}/{pendingPagination.totalPages}ページ
                    </div>
                    {pendingRequests.map((entry) => (
                        <div key={entry.id} className="p-4 border-t border-border bg-amber-50/40 flex items-center gap-4">
                            <Link href={`/user/${entry.follower.handle}`} aria-label={`@${entry.follower.handle} のプロフィール`}>
                                {entry.follower.avatarUrl ? (
                                    <img
                                        src={entry.follower.avatarUrl}
                                        alt="ユーザー画像"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-400" />
                                )}
                            </Link>
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={`/user/${entry.follower.handle}`}
                                    className="font-bold text-sm hover:underline"
                                >
                                    {entry.follower.name ?? 'ユーザー'}
                                </Link>
                                <div>
                                    <Link
                                        href={`/user/${entry.follower.handle}`}
                                        className="text-xs text-zinc-500 hover:underline"
                                    >
                                        @{entry.follower.handle}
                                    </Link>
                                </div>
                                {entry.follower.bio && (
                                    <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{entry.follower.bio}</div>
                                )}
                                <div className="mt-1 text-[11px] text-zinc-400">
                                    申請日時{' '}
                                    {entry.createdAt.toLocaleString('ja-JP', {
                                        timeZone: 'Asia/Tokyo',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <AcceptFollowForm followerId={entry.follower.id} />
                                <RejectFollowForm followerId={entry.follower.id} />
                            </div>
                        </div>
                    ))}
                    <PaginationLinks
                        page={pendingPagination.page}
                        totalPages={pendingPagination.totalPages}
                        previousHref={
                            pendingPagination.hasPrevious
                                ? `/profile/followers?page=${acceptedPagination.page}&pendingPage=${pendingPagination.page - 1}`
                                : null
                        }
                        nextHref={
                            pendingPagination.hasNext
                                ? `/profile/followers?page=${acceptedPagination.page}&pendingPage=${pendingPagination.page + 1}`
                                : null
                        }
                    />
                </section>
            )}

            <div className="flex flex-col">
                {followerCount > 0 && (
                    <div className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        承認済み {followerCount}件・{acceptedPagination.page}/{acceptedPagination.totalPages}ページ
                    </div>
                )}
                {followers.map((entry) => (
                    <div key={entry.id} className="p-4 border-b border-border flex items-center gap-4">
                        <Link href={`/user/${entry.follower.handle}`} aria-label={`@${entry.follower.handle} のプロフィール`}>
                            {entry.follower.avatarUrl ? (
                                <img
                                    src={entry.follower.avatarUrl}
                                    alt="ユーザー画像"
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-400" />
                            )}
                        </Link>
                        <div className="min-w-0 flex-1 flex flex-col">
                            <Link
                                href={`/user/${entry.follower.handle}`}
                                className="font-bold text-sm hover:underline"
                            >
                                {entry.follower.name ?? 'ユーザー'}
                            </Link>
                            <Link
                                href={`/user/${entry.follower.handle}`}
                                className="text-xs text-zinc-500 hover:underline"
                            >
                                @{entry.follower.handle}
                            </Link>
                            {entry.follower.bio && (
                                <span className="text-xs text-zinc-500">{entry.follower.bio}</span>
                            )}
                            {entry.acceptedAt && (
                                <span className="mt-1 text-[11px] text-zinc-400">
                                    フォロー開始{' '}
                                    {entry.acceptedAt.toLocaleDateString('ja-JP', {
                                        timeZone: 'Asia/Tokyo',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                    })}
                                </span>
                            )}
                        </div>
                        <RemoveFollowerForm followerId={entry.follower.id} />
                    </div>
                ))}
                {followerCount > 0 && (
                    <PaginationLinks
                        page={acceptedPagination.page}
                        totalPages={acceptedPagination.totalPages}
                        previousHref={
                            acceptedPagination.hasPrevious
                                ? `/profile/followers?page=${acceptedPagination.page - 1}&pendingPage=${pendingPagination.page}`
                                : null
                        }
                        nextHref={
                            acceptedPagination.hasNext
                                ? `/profile/followers?page=${acceptedPagination.page + 1}&pendingPage=${pendingPagination.page}`
                                : null
                        }
                    />
                )}
                {followerCount === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">
                        {pendingRequestCount > 0 ? '承認済みフォロワーはいません' : 'フォロワーはいません'}
                    </div>
                )}
            </div>
        </div>
    );
}
