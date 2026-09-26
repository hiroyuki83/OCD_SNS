import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
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
                フォロー一覧を見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const following = await prisma.follow.findMany({
        where: { followerId: userId },
        select: {
            id: true,
            acceptedAt: true,
            following: {
                select: {
                    id: true,
                    handle: true,
                    name: true,
                    bio: true,
                    avatarUrl: true,
                    isPrivate: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const acceptedFollowingCount = following.filter((entry) => entry.acceptedAt).length;
    const pendingFollowingCount = following.length - acceptedFollowingCount;

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center justify-between px-4">
                <h1 className="font-bold text-base">
                    フォロー {acceptedFollowingCount}
                    {pendingFollowingCount > 0 ? `（申請中 ${pendingFollowingCount}）` : ''}
                </h1>
                <Link href="/profile" className="text-xs text-[#1d9bf0] hover:underline">
                    プロフィールへ戻る
                </Link>
            </div>
            <div className="flex flex-col">
                {following.map((entry) => (
                    <div key={entry.id} className="p-4 border-b border-border flex items-center gap-4">
                        {entry.following.avatarUrl ? (
                            <img
                                src={entry.following.avatarUrl}
                                alt="ユーザー画像"
                                className="w-10 h-10 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                            <Link
                                href={`/user/${entry.following.handle}`}
                                className="font-bold text-sm hover:underline"
                            >
                                {entry.following.name ?? 'ユーザー'}
                            </Link>
                            <div>
                                <Link
                                    href={`/user/${entry.following.handle}`}
                                    className="text-xs text-zinc-500 hover:underline"
                                >
                                    @{entry.following.handle}
                                </Link>
                            </div>
                            {entry.following.bio && (
                                <div className="text-xs text-zinc-500">{entry.following.bio}</div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {entry.following.isPrivate && (
                                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                                    非公開
                                </span>
                            )}
                            {!entry.acceptedAt && (
                                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                                    申請中
                                </span>
                            )}
                        </div>
                    </div>
                ))}
                {following.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">フォロー一覧にユーザーがいません</div>
                )}
            </div>
        </div>
    );
}
