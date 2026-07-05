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
        include: { following: true },
        orderBy: { createdAt: 'desc' },
    });

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">フォロー一覧</h1>
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
                        <div className="flex flex-col">
                            <span className="font-bold text-sm">{entry.following.name ?? 'ユーザー'}</span>
                            <span className="text-xs text-zinc-500">@{entry.following.email.split('@')[0]}</span>
                            {entry.following.bio && (
                                <span className="text-xs text-zinc-500">{entry.following.bio}</span>
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
