import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { acceptFollowRequest, rejectFollowRequest } from '@/app/lib/actions';

export const dynamic = 'force-dynamic';

export default async function FollowersPage() {
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

    const [followers, pendingRequests] = await Promise.all([
        prisma.follow.findMany({
            where: {
                followingId: userId,
                acceptedAt: { not: null },
            },
            select: {
                id: true,
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
            orderBy: { createdAt: 'desc' },
        }),
        prisma.follow.findMany({
            where: {
                followingId: userId,
                acceptedAt: null,
            },
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
            orderBy: { createdAt: 'desc' },
        }),
    ]);

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center justify-between px-4">
                <h1 className="font-bold text-base">
                    フォロワー {followers.length}
                    {pendingRequests.length > 0 ? `（承認待ち ${pendingRequests.length}）` : ''}
                </h1>
                <Link href="/profile" className="text-xs text-[#1d9bf0] hover:underline">
                    プロフィールへ戻る
                </Link>
            </div>

            {pendingRequests.length > 0 && (
                <section className="border-b border-border">
                    <div className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        承認待ち {pendingRequests.length}件
                    </div>
                    {pendingRequests.map((entry) => (
                        <div key={entry.id} className="p-4 border-t border-border flex items-center gap-4">
                            {entry.follower.avatarUrl ? (
                                <img
                                    src={entry.follower.avatarUrl}
                                    alt="ユーザー画像"
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-400" />
                            )}
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
                            </div>
                            <div className="flex gap-2">
                                <form action={acceptFollowRequest.bind(null, entry.follower.id)}>
                                    <button
                                        type="submit"
                                        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                                    >
                                        承認
                                    </button>
                                </form>
                                <form action={rejectFollowRequest.bind(null, entry.follower.id)}>
                                    <button
                                        type="submit"
                                        className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700"
                                    >
                                        拒否
                                    </button>
                                </form>
                            </div>
                        </div>
                    ))}
                </section>
            )}

            <div className="flex flex-col">
                {followers.map((entry) => (
                    <div key={entry.id} className="p-4 border-b border-border flex items-center gap-4">
                        {entry.follower.avatarUrl ? (
                            <img
                                src={entry.follower.avatarUrl}
                                alt="ユーザー画像"
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-400" />
                        )}
                        <div className="flex flex-col">
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
                        </div>
                    </div>
                ))}
                {followers.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">
                        {pendingRequests.length > 0 ? '承認済みフォロワーはいません' : 'フォロワーはいません'}
                    </div>
                )}
            </div>
        </div>
    );
}
