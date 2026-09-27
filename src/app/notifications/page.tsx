
export const dynamic = 'force-dynamic';
﻿import Link from 'next/link';
import { auth } from '@/auth';
import { Prisma, WarningAppealStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { visibleAccountFilter } from '@/lib/accountStatus';
import { submitWarningAppeal } from './actions';
import { acceptFollowRequest, rejectFollowRequest } from '@/app/lib/actions';
import NotificationsReadMarker from '@/components/layout/NotificationsReadMarker';

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

    const notificationActorFilter: Prisma.UserWhereInput = {
        AND: [
            visibleAccountFilter(new Date()),
            { blockedBy: { none: { blockerId: resolvedUserId } } },
            { blocksInitiated: { none: { blockedId: resolvedUserId } } },
            { mutedBy: { none: { muterId: resolvedUserId } } },
        ],
    };

    const [notifications, warnings] = await Promise.all([
        prisma.notification.findMany({
            where: {
                userId: resolvedUserId,
                actor: notificationActorFilter,
                OR: [
                    { type: 'FOLLOW' },
                    {
                        post: {
                            is: {
                                deletedAt: null,
                                isHidden: false,
                            },
                        },
                    },
                ],
            },
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
                        avatarUrl: true,
                    },
                },
                post: {
                    select: {
                        id: true,
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
    ]);

    const followActorIds = Array.from(
        new Set(
            notifications
                .filter((notification) => notification.type === 'FOLLOW')
                .map((notification) => notification.actorId),
        ),
    );

    const pendingFollowRows =
        followActorIds.length > 0
            ? await prisma.follow.findMany({
                  where: {
                      followingId: resolvedUserId,
                      followerId: { in: followActorIds },
                      acceptedAt: null,
                  },
                  select: { followerId: true },
              })
            : [];
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
        <>
            <NotificationsReadMarker />
            <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">通知</h1>
            </div>
            <div className="flex flex-col">
                {items.map((item) => {
                    const timestamp = item.createdAt.toLocaleString('ja-JP', {
                        timeZone: 'Asia/Tokyo',
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
                                    {item.warning.revokedAt
                                        ? "この警告は取り消されており、現在は有効ではありません。"
                                        : "今後同様の行為が続く場合、投稿制限やアカウント停止の対象となる場合があります。"}
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
                                ) : item.warning.revokedAt ? (
                                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800">
                                        警告が取り消されているため、異議申立ては不要です。
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
                            className={`p-4 border-b border-border flex gap-3 text-sm ${
                                notification.type === 'FOLLOW' && pendingFollowerIds.has(notification.actorId)
                                    ? 'bg-amber-50/40'
                                    : ''
                            }`}
                        >
                            <Link
                                href={`/user/${notification.actor.handle}`}
                                className="shrink-0"
                                aria-label={`@${notification.actor.handle} のプロフィール`}
                            >
                                {notification.actor.avatarUrl ? (
                                    <img
                                        src={notification.actor.avatarUrl}
                                        alt="ユーザー画像"
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="h-10 w-10 rounded-full bg-slate-400" />
                                )}
                            </Link>
                            <div className="min-w-0 flex-1">
                                <div className="text-zinc-400 text-xs">{timestamp}</div>
                                <div>
                                <Link
                                    href={`/user/${notification.actor.handle}`}
                                    className="font-bold hover:underline"
                                >
                                    {actorName}
                                </Link>
                                {notification.type === 'LIKE' && ' があなたの投稿にいいねしました。'}
                                {notification.type === 'WAKARU' && ' があなたの投稿に「わかる」を押しました。'}
                                {notification.type === 'GANBATTA' && ' があなたの投稿に「頑張った！」を押しました。'}
                                {notification.type === 'FOLLOW' &&
                                    (pendingFollowerIds.has(notification.actorId)
                                        ? ' からフォロー申請が届きました。'
                                        : ' があなたをフォローしました。')}
                            </div>
                            {notification.type === 'FOLLOW' &&
                                pendingFollowerIds.has(notification.actorId) && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        <Link
                                            href={`/user/${notification.actor.handle}`}
                                            className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700"
                                        >
                                            プロフィールを見る
                                        </Link>
                                        <form action={acceptFollowRequest.bind(null, notification.actorId)}>
                                            <button
                                                type="submit"
                                                className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
                                            >
                                                承認
                                            </button>
                                        </form>
                                        <form action={rejectFollowRequest.bind(null, notification.actorId)}>
                                            <button
                                                type="submit"
                                                className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700"
                                            >
                                                拒否
                                            </button>
                                        </form>
                                        <Link
                                            href="/profile/followers"
                                            className="px-2 py-1 text-xs font-semibold text-[#1d9bf0] hover:underline"
                                        >
                                            申請一覧
                                        </Link>
                                    </div>
                                )}
                            {notification.post?.id &&
                                (notification.type === 'LIKE' ||
                                    notification.type === 'WAKARU' ||
                                    notification.type === 'GANBATTA') && (
                                    <Link
                                        href={`/post?id=${notification.post.id}`}
                                        className="mt-1 block text-zinc-500 text-xs line-clamp-2 hover:underline"
                                    >
                                        {notification.post.content?.trim() || '投稿を開く'}
                                    </Link>
                                )}
                            </div>
                        </div>
                    );
                })}
                {items.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">通知はまだありません</div>
                )}
            </div>
            </div>
        </>
    );
}
