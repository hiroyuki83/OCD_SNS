import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { UnmuteForm } from '@/components/profile/ProfileRelationActions';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export default async function MutesPage({
    searchParams,
}: {
    searchParams?: { page?: string };
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
                ミュート一覧を見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const muteCount = await prisma.mute.count({ where: { muterId: userId } });
    const pagination = clampPage(parsePageNumber(searchParams?.page), muteCount, 50);
    const mutes = await prisma.mute.findMany({
        where: { muterId: userId },
        select: {
            id: true,
            createdAt: true,
            muted: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    bio: true,
                    avatarUrl: true,
                },
            },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
    });

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center justify-between px-4">
                <h1 className="font-bold text-base">ミュート {muteCount}</h1>
                <Link href="/profile" className="text-xs text-[#1d9bf0] hover:underline">
                    プロフィールへ戻る
                </Link>
            </div>
            <div className="flex flex-col">
                {muteCount > 0 && (
                    <div className="px-4 py-2 text-xs text-zinc-500 border-b border-border">
                        ミュート {muteCount}件・{pagination.page} / {pagination.totalPages}ページ
                    </div>
                )}
                {mutes.map((entry) => (
                    <div key={entry.id} className="p-4 border-b border-border flex items-center gap-4 justify-between">
                        <div className="flex items-center gap-4">
                            <Link href={`/user/${entry.muted.handle}`} aria-label={`@${entry.muted.handle} のプロフィール`}>
                                {entry.muted.avatarUrl ? (
                                    <img
                                        src={entry.muted.avatarUrl}
                                        alt="ユーザー画像"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-400" />
                                )}
                            </Link>
                            <div className="flex flex-col">
                                <Link href={`/user/${entry.muted.handle}`} className="font-bold text-sm hover:underline">
                                    {entry.muted.name ?? 'ユーザー'}
                                </Link>
                                <Link href={`/user/${entry.muted.handle}`} className="text-xs text-zinc-500 hover:underline">
                                    @{entry.muted.handle}
                                </Link>
                                {entry.muted.bio && (
                                    <span className="text-xs text-zinc-500">{entry.muted.bio}</span>
                                )}
                                <span className="mt-1 text-[11px] text-zinc-400">
                                    ミュート開始{' '}
                                    {entry.createdAt.toLocaleDateString('ja-JP', {
                                        timeZone: 'Asia/Tokyo',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>
                        <UnmuteForm targetUserId={entry.muted.id} />
                    </div>
                ))}
                {muteCount > 0 && (
                    <PaginationLinks
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        previousHref={pagination.hasPrevious ? `/profile/mutes?page=${pagination.page - 1}` : null}
                        nextHref={pagination.hasNext ? `/profile/mutes?page=${pagination.page + 1}` : null}
                    />
                )}
                {muteCount === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">ミュート中のユーザーがいません</div>
                )}
            </div>
        </div>
    );
}
