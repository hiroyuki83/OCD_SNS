import Link from 'next/link';
import { auth } from '@/auth';
import { WarningAppealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { submitWarningAppeal } from './actions';

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

    const [notifications, warnings, pendingFollowRows] = await Promise.all([
        prisma.notification.findMany({
            where: { userId: resolvedUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                type: true,
                actorId: true,
                createdAt: true,
                actor: {
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                    },
                },
                post: {
                    select: {
                        content: true,
                    },
                },
            },
            take: 50,
        }),
        prisma.moderationWarning.findMany({
            where: { targetUserId: resolvedUserId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                reason: true,
                createdAt: true,
                revokedAt: true,
                appeal: {
                    select: {
                        id: true,
                        message: true,
                        createdAt: true,
                        status: true,
                        resolutionNote: true,
                        reviewedAt: true,
                    },
                },
            },
            take: 50,
        }),
        prisma.follow.findMany({
            where: {
                followingId: resolvedUserId,
                acceptedAt: null,
            },
            select: { followerId: true },
        }),
    ]);

    const pendingFollowerIds = new Set(pendingFollowRows.map((row) => row.followerId));

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
                                <div className={item.warning.revokedAt ? "font-bold text-green-800" : "font-bold text-amber-900"}>
                                    {item.warning.revokedAt ? "運営からの警告（取消済み）" : "運営からの警告"}
                                </div>
                                <div className="whitespace-pre-wrap break-words text-zinc-800">
                                    {item.warning.reason}
                                </div>
                                <div className="text-xs text-zinc-500">
                                    今後同様の行為が続く場合、投稿制限やアカウント停止の対象となる場合があります。
                                </div>
                                {item.warning.appeal ? (
                                    <div className="rounded-md border border-amber-200 bg-white/70 p-3">
                                        <div className="text-xs font-semibold text-zinc-700">
                                            {item.warning.appeal.status === WarningAppealStatus.PENDING
                                                ? "異議申立てを受け付けました"
                                                : item.warning.appeal.status === WarningAppealStatus.UPHELD
                                                  ? "異議申立て結果：警告を維持しました"
                                                  : "異議申立て結果：警告を取り消しました"}
                                        </div>
                                        <div className="mt-1 whitespace-pre-wrap break-words text-xs text-zinc-600">
                                            {item.warning.appeal.message}
                                        </div>
                                        {item.warning.appeal.resolutionNote && (
                                            <div className="mt-2 border-t border-amber-100 pt-2 text-xs text-zinc-700">
                                                <span className="font-semibold">運営の判断理由：</span>
                                                <span className="whitespace-pre-wrap break-words">
                                                    {item.warning.appeal.resolutionNote}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <form
                                        action={submitWarningAppeal}
                                        className="rounded-md border border-amber-200 bg-white/70 p-3"
                                    >
                                        <input type="hidden" name="warningId" value={item.warning.id} />
                                        <label className="block text-xs font-semibold text-zinc-700">
                                            この警告に異議申立てをする
                                            <textarea
                                                name="message"
                                                minLength={10}
                                                maxLength={1000}
                                                required
                                                rows={3}
                                                placeholder="警告が適切でないと考える理由を入力してください"
                                                className="mt-2 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
                                            />
                                        </label>
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                type="submit"
                                                className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-900"
                                            >
                                                異議申立てを送信
                                            </button>
                                        </div>
                                    </form>
                                )}
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
                                {notification.type === 'FOLLOW' &&
                                    (pendingFollowerIds.has(notification.actorId)
                                        ? ' がフォローリクエストを送信しました。'
                                        : ' があなたをフォローしました。')}
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
