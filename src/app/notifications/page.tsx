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

    const readAt = new Date();
    await Promise.all([
        prisma.notification.updateMany({
            where: { userId: resolvedUserId, readAt: null },
            data: { readAt },
        }),
        prisma.moderationWarning.updateMany({
            where: { targetUserId: resolvedUserId, readAt: null },
            data: { readAt },
        }),
    ]);

    const [notifications, warnings] = await Promise.all([
        prisma.notification.findMany({
            where: { userId: resolvedUserId },
            orderBy: { createdAt: 'desc' },
            include: { actor: true, post: true },
            take: 50,
        }),
        prisma.moderationWarning.findMany({
            where: { targetUserId: resolvedUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                reason: true,
                createdAt: true,
            },
            take: 50,
        }),
    ]);

    const items = [
        ...notifications.map((notification) => ({
            kind: 'notification' as const,
            id: `notification-${notification.id}`,
            createdAt: notification.createdAt,
            notification,
        })),
        ...warnings.map((warning) => ({
            kind: 'warning' as const,
            id: `warning-${warning.id}`,
            createdAt: warning.createdAt,
            warning,
        })),
    ]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50);

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">通知</h1>
            </div>
            <div className="flex flex-col">
                {items.map((item) => {
                    const timestamp = item.createdAt.toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                    });

                    if (item.kind === 'warning') {
                        return (
                            <div
                                key={item.id}
                                className="p-4 border-b border-border flex flex-col gap-2 text-sm bg-amber-50/60"
                            >
                                <div className="text-zinc-500 text-xs">{timestamp}</div>
                                <div className="font-bold text-amber-900">運営からの警告</div>
                                <div className="whitespace-pre-wrap break-words text-zinc-800">
                                    {item.warning.reason}
                                </div>
                                <div className="text-xs text-zinc-500">
                                    今後同様の行為が続く場合、投稿制限やアカウント停止の対象となる場合があります。
                                </div>
                            </div>
                        );
                    }

                    const notification = item.notification;
                    const actorName = notification.actor.name ?? `@${notification.actor.handle}`;

                    return (
                        <div
                            key={item.id}
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
                {items.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">通知はまだありません</div>
                )}
            </div>
        </div>
    );
}
