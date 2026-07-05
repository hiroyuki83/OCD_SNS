import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export default async function NotificationsPage() {
    const session = await auth();
    const userId = session?.user?.id;

    if (!session?.user) {
        return (
            <div className="p-6 text-sm text-zinc-400">
                通知を見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const resolvedUserId = userId
        ? userId
        : session.user.email
          ? (
                await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { id: true },
                })
            )?.id
          : null;

    if (!resolvedUserId) {
        return <div className="p-6 text-sm text-zinc-400">通知を取得できませんでした。</div>;
    }

    await prisma.notification.updateMany({
        where: { userId: resolvedUserId, readAt: null },
        data: { readAt: new Date() },
    });

    const notifications = await prisma.notification.findMany({
        where: { userId: resolvedUserId },
        orderBy: { createdAt: 'desc' },
        include: { actor: true, post: true },
        take: 50,
    });

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">通知</h1>
            </div>
            <div className="flex flex-col">
                {notifications.map((notification) => {
                    const actorName = notification.actor.name ?? notification.actor.email.split('@')[0];
                    const timestamp = notification.createdAt.toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    return (
                        <div
                            key={notification.id}
                            className="p-4 border-b border-border flex flex-col gap-1 text-sm"
                        >
                            <div className="text-zinc-400 text-xs">{timestamp}</div>
                            <div>
                                <span className="font-bold">{actorName}</span>
                                {notification.type === 'LIKE' && ' があなたの投稿にいいねしました。'}
                                {notification.type === 'WAKARU' && ' があなたの投稿に「わかる」を押しました。'}
                                {notification.type === 'GANBATTA' && ' があなたの投稿に「頑張った！」を押しました。'}
                                {notification.type === 'FOLLOW' && ' があなたをフォローしました。'}
                            </div>
                            {notification.type === 'LIKE' && notification.post?.content && (
                                <div className="text-zinc-500 text-xs line-clamp-2">
                                    {notification.post.content}
                                </div>
                            )}
                        </div>
                    );
                })}
                {notifications.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">通知はまだありません</div>
                )}
            </div>
        </div>
    );
}
