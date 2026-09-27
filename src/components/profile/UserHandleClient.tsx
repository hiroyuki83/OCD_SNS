'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';
import { REPORT_REASONS, type ReportReasonValue } from '@/lib/reportReasons';

type ProfilePost = {
    id: string;
    content: string;
    imageUrl: string | null;
    createdAt: string;
    likeCount: number;
    bookmarkCount: number;
    wakaruCount: number;
    ganbattaCount: number;
    liked: boolean;
    bookmarked: boolean;
    wakaruReacted: boolean;
    ganbattaReacted: boolean;
};

type ProfileResponse = {
    user: {
        id: string;
        name: string | null;
        handle: string;
        bio: string | null;
        avatarUrl: string | null;
        headerUrl: string | null;
        isPrivate?: boolean;
        followerCount: number;
        followingCount: number;
    };
    posts: ProfilePost[];
    isFollowing: boolean;
    isFollowPending: boolean;
    isBlocked: boolean;
    isMuted: boolean;
    isBlockedBy: boolean;
    viewerId: string | null;
    postCount: number;
    page: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
};

export default function UserHandleClient() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawHandle = useMemo(() => {
        const value = params?.handle;
        return Array.isArray(value) ? value[0] ?? '' : (value ?? '');
    }, [params]);
    const handle = useMemo(() => {
        const trimmed = rawHandle.trim();
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    }, [rawHandle]);
    const rawPage = searchParams.get('page') ?? '1';
    const requestedPage =
        /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage))
            ? Math.max(1, Number(rawPage))
            : 1;

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [localFollowing, setLocalFollowing] = useState(false);
    const [localFollowPending, setLocalFollowPending] = useState(false);
    const [localBlocked, setLocalBlocked] = useState(false);
    const [localMuted, setLocalMuted] = useState(false);
    const [localBlockedBy, setLocalBlockedBy] = useState(false);
    const [reportingUser, setReportingUser] = useState(false);
    const [pendingRelationAction, setPendingRelationAction] = useState<'follow' | 'block' | 'mute' | null>(null);
    const [pendingPostAction, setPendingPostAction] = useState<string | null>(null);

    const fetchProfile = useMemo(
        () => async (signal?: AbortSignal) => {
            if (!handle || handle.length > 64) {
                setStatus('error');
                return;
            }
            setStatus('loading');
            try {
                const res = await fetch(
                    `/api/user-handle?handle=${encodeURIComponent(handle)}&page=${requestedPage}`,
                    {
                        cache: 'no-store',
                        signal,
                    },
                );
                if (!res.ok) throw new Error('failed');
                const data = await res.json();
                if (!data?.user) throw new Error('not found');
                if (signal?.aborted) return;
                setProfile(data);
                setStatus('idle');
            } catch {
                if (signal?.aborted) return;
                setStatus('error');
            }
        },
        [handle, requestedPage],
    );

    useEffect(() => {
        if (!handle) return;
        const controller = new AbortController();
        fetchProfile(controller.signal);
        return () => {
            controller.abort();
        };
    }, [handle, requestedPage, fetchProfile]);

    useEffect(() => {
        if (profile) {
            setLocalFollowing(profile.isFollowing);
            setLocalFollowPending(profile.isFollowPending);
            setLocalBlocked(profile.isBlocked);
            setLocalMuted(profile.isMuted);
            setLocalBlockedBy(profile.isBlockedBy);
        }
    }, [profile]);

    const reconcilePostAction = (
        postId: string,
        action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark',
        active: boolean,
        count: number | undefined,
    ) => {
        setProfile((current) => {
            if (!current) return current;
            return {
                ...current,
                posts: current.posts.map((post) => {
                    if (post.id !== postId) return post;
                    if (action === 'like') {
                        return {
                            ...post,
                            liked: active,
                            likeCount: typeof count === 'number' ? Math.max(0, count) : post.likeCount,
                        };
                    }
                    if (action === 'bookmark') {
                        return {
                            ...post,
                            bookmarked: active,
                            bookmarkCount:
                                typeof count === 'number' ? Math.max(0, count) : post.bookmarkCount,
                        };
                    }
                    if (action === 'wakaru') {
                        return {
                            ...post,
                            wakaruReacted: active,
                            wakaruCount:
                                typeof count === 'number' ? Math.max(0, count) : post.wakaruCount,
                        };
                    }
                    return {
                        ...post,
                        ganbattaReacted: active,
                        ganbattaCount:
                            typeof count === 'number' ? Math.max(0, count) : post.ganbattaCount,
                    };
                }),
            };
        });
    };

    const runPostAction = async (postId: string, action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark') => {
        const actionKey = `${postId}:${action}`;
        if (pendingPostAction) return;
        setPendingPostAction(actionKey);
        try {
            const res = await fetch('/api/post-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action }),
            });
            if (!res.ok) throw new Error('failed');
            const payload = await res.json();
            if (typeof payload?.active !== 'boolean') throw new Error('invalid response');
            reconcilePostAction(
                postId,
                action,
                payload.active,
                typeof payload?.count === 'number' ? payload.count : undefined,
            );
        } catch {
            await fetchProfile();
        } finally {
            setPendingPostAction(null);
        }
    };

    const reportUser = async () => {
        if (!profile?.viewerId || !profile.user.id || reportingUser) return;
        const reasonGuide = REPORT_REASONS.map((reason, index) => `${index + 1}. ${reason.label}`).join('\n');
        const selected = window.prompt(`通報理由を番号で選んでください。\n${reasonGuide}`);
        if (selected === null) return;
        const normalizedSelection = selected.trim();
        if (!/^\d+$/.test(normalizedSelection)) {
            alert('通報理由の番号が正しくありません。');
            return;
        }
        const selectedIndex = Number(normalizedSelection) - 1;
        const selectedReason = REPORT_REASONS[selectedIndex];
        if (!selectedReason) {
            alert('通報理由の番号が正しくありません。');
            return;
        }
        const reason: ReportReasonValue = selectedReason.value;
        const detail = window.prompt(
            reason === 'OTHER'
                ? '「その他」の場合は、通報理由を10〜500文字で入力してください。'
                : '必要であれば詳細を入力してください（500文字以内・空欄可）。',
        );
        if (detail === null) return;
        const normalizedDetail = detail.trim();
        const detailLength = Array.from(normalizedDetail).length;
        if (detailLength > 500) {
            alert('通報理由は500文字以内で入力してください。');
            return;
        }
        if (reason === 'OTHER' && detailLength < 10) {
            alert('「その他」の場合は、通報理由を10文字以上入力してください。');
            return;
        }
        const boundedDetail = normalizedDetail;

        setReportingUser(true);
        try {
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: profile.user.id, reason, detail: boundedDetail }),
            });
            if (!res.ok) {
                let message = '通報に失敗しました。';
                try {
                    const payload = await res.json();
                    if (payload?.error) message = payload.error;
                } catch {
                    // ignore
                }
                alert(message);
                return;
            }
            alert('通報を受け付けました。');
        } catch {
            alert('通信エラーのため通報を送信できませんでした。');
        } finally {
            setReportingUser(false);
        }
    };

    if (!handle) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーIDが未指定です。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    if (status === 'loading') {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (status === 'error' || !profile) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーが見つかりませんでした。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const {
        user,
        posts,
        viewerId,
        postCount,
        page,
        totalPages,
        hasPrevious,
        hasNext,
    } = profile;
    const isPrivate = !!user.isPrivate;
    const canViewPosts = !isPrivate || viewerId === user.id || localFollowing;

    const toggleFollow = async () => {
        if (!viewerId || pendingRelationAction) return;
        setPendingRelationAction('follow');
        try {
            const action = localFollowing || localFollowPending ? 'unfollow' : 'follow';
            const res = await fetch('/api/follow-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action }),
            });
            if (!res.ok) return;
            await fetchProfile();
        } finally {
            setPendingRelationAction(null);
        }
    };

    const toggleBlock = async () => {
        if (!viewerId || pendingRelationAction) return;
        setPendingRelationAction('block');
        try {
            const res = await fetch('/api/block-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action: localBlocked ? 'unblock' : 'block' }),
            });
            if (!res.ok) return;
            setLocalBlocked((prev) => !prev);
            if (!localBlocked) {
                setLocalFollowing(false);
                setLocalFollowPending(false);
            }
            await fetchProfile();
        } finally {
            setPendingRelationAction(null);
        }
    };

    const toggleMute = async () => {
        if (!viewerId || pendingRelationAction) return;
        setPendingRelationAction('mute');
        try {
            const res = await fetch('/api/mute-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action: localMuted ? 'unmute' : 'mute' }),
            });
            if (!res.ok) return;
            setLocalMuted((prev) => !prev);
            await fetchProfile();
        } finally {
            setPendingRelationAction(null);
        }
    };

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">プロフィール</h1>
            </div>
            <div className="border-b border-border">
                <div className="h-32 bg-zinc-900">
                    {user.headerUrl && (
                        <img src={user.headerUrl} alt="ヘッダー画像" className="h-32 w-full object-cover" />
                    )}
                </div>
                <div className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="-mt-10">
                            {user.avatarUrl ? (
                                <img
                                    src={user.avatarUrl}
                                    alt="プロフィール画像"
                                    className="w-20 h-20 rounded-full border-4 border-white object-cover"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-slate-400 border-4 border-white" />
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-lg font-bold">{user.name ?? 'ユーザー'}</span>
                            <span className="text-sm text-zinc-500">@{user.handle}</span>
                            {user.bio && <p className="text-sm text-zinc-500">{user.bio}</p>}
                            <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                                <span>フォロー {user.followingCount}</span>
                                <span>フォロワー {user.followerCount}</span>
                            </div>
                        </div>
                    </div>
                    {isPrivate && (
                        <span className="text-xs text-zinc-500">非公開</span>
                    )}
                    {viewerId && viewerId !== user.id && (
                        <div className="flex items-center gap-3">
                            {!localBlocked && !localBlockedBy && (
                                <button
                                    type="button"
                                    onClick={toggleFollow}
                                    className="text-xs text-[#1d9bf0] hover:underline disabled:opacity-50"
                                    disabled={pendingRelationAction !== null}
                                    aria-pressed={localFollowing || localFollowPending}
                                >
                                    {localFollowing
                                        ? 'フォロー中'
                                        : localFollowPending
                                          ? '申請中（取り消す）'
                                          : 'フォローする'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={toggleMute}
                                className={`text-xs ${localMuted ? 'text-zinc-500' : 'text-[#1d9bf0]'} hover:underline`}
                                disabled={localBlockedBy || pendingRelationAction !== null}
                                aria-pressed={localMuted}
                            >
                                {localMuted ? 'ミュート解除' : 'ミュート'}
                            </button>
                            <button
                                type="button"
                                onClick={toggleBlock}
                                className={`text-xs ${localBlocked ? 'text-red-500' : 'text-[#1d9bf0]'} hover:underline disabled:opacity-50`}
                                disabled={pendingRelationAction !== null}
                                aria-pressed={localBlocked}
                            >
                                {localBlocked ? 'ブロック解除' : 'ブロック'}
                            </button>
                            {viewerId !== user.id && (
                                <button
                                    type="button"
                                    onClick={reportUser}
                                    className="text-xs text-zinc-500 hover:text-red-500"
                                    disabled={reportingUser}
                                >
                                    {reportingUser ? '送信中' : '通報'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col">
                {!localBlocked && !localMuted && !localBlockedBy && canViewPosts && postCount > 0 && (
                    <div className="px-4 py-2 text-xs text-zinc-500 border-b border-border">
                        投稿 {postCount}件・{page}/{totalPages}ページ
                    </div>
                )}
                {(localBlocked || localMuted || localBlockedBy) && (
                    <div className="p-4 text-sm text-zinc-500 border-b border-border">
                        {localBlockedBy
                            ? 'このユーザーにブロックされています。投稿は表示されません。'
                            : localBlocked
                                ? 'ブロック中のため投稿は表示されません。'
                                : 'ミュート中のため投稿は表示されません。'}
                    </div>
                )}
                {!localBlocked && !localMuted && !localBlockedBy && !canViewPosts && (
                    <div className="p-4 text-sm text-zinc-500 border-b border-border">
                        {localFollowPending
                            ? 'フォロー申請を送信済みです。承認されると投稿を表示できます。'
                            : 'このアカウントは非公開です。承認されたフォロワーのみ投稿を表示できます。'}
                    </div>
                )}
                {posts.map((post) => (
                    <div
                        key={post.id}
                        className="p-4 border-b border-border hover:bg-zinc-50 transition-colors flex gap-4 relative"
                    >
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="プロフィール画像"
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 flex flex-col gap-2 relative z-10">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold">{user.name ?? 'ユーザー'}</span>
                                <span className="text-zinc-500">@{user.handle}</span>
                                <span className="text-zinc-500">・</span>
                                <span className="text-zinc-500">{formatPostTime(post.createdAt)}</span>
                            </div>
                            {post.content && <HashtagText text={post.content} className="text-sm" />}
                            {post.imageUrl && (
                                <img
                                    src={post.imageUrl}
                                    alt="投稿画像"
                                    className="mt-2 rounded-2xl border border-border max-h-[480px] object-cover"
                                />
                            )}
                            <div className="flex items-center gap-3 text-zinc-500 flex-wrap relative z-30 feed-action-area" data-action-area>
                                {viewerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'like'); }}
                                        aria-pressed={post.liked}
                                        disabled={pendingPostAction !== null}
                                        className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors disabled:opacity-50 ${
                                            post.liked ? 'text-red-500' : 'hover:text-red-500'
                                        }`}
                                    >
                                        いいね
                                        <span>{post.likeCount}</span>
                                    </button>
                                ) : (
                                    <div className="text-xs">いいね {post.likeCount}</div>
                                )}
                                {viewerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'wakaru'); }}
                                        aria-pressed={post.wakaruReacted}
                                        disabled={pendingPostAction !== null}
                                        className={`text-xs rounded-full px-3 py-1 transition-colors disabled:opacity-50 ${
                                            post.wakaruReacted ? 'text-yellow-400' : 'hover:text-yellow-400'
                                        }`}
                                    >
                                        わかる <span>{post.wakaruCount}</span>
                                    </button>
                                ) : (
                                    <div className="text-xs">わかる {post.wakaruCount}</div>
                                )}
                                {viewerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'ganbatta'); }}
                                        aria-pressed={post.ganbattaReacted}
                                        disabled={pendingPostAction !== null}
                                        className={`text-xs rounded-full px-3 py-1 transition-colors disabled:opacity-50 ${
                                            post.ganbattaReacted ? 'text-green-400' : 'hover:text-green-400'
                                        }`}
                                    >
                                        頑張った！ <span>{post.ganbattaCount}</span>
                                    </button>
                                ) : (
                                    <div className="text-xs">頑張った！ {post.ganbattaCount}</div>
                                )}
                                {viewerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'bookmark'); }}
                                        aria-pressed={post.bookmarked}
                                        disabled={pendingPostAction !== null}
                                        className={`text-xs rounded-full px-3 py-1 transition-colors disabled:opacity-50 ${
                                            post.bookmarked ? 'text-blue-400' : 'hover:text-blue-400'
                                        }`}
                                    >
                                        ブックマーク <span>{post.bookmarkCount}</span>
                                    </button>
                                ) : (
                                    <div className="text-xs">ブックマーク {post.bookmarkCount}</div>
                                )}
                                <Link
                                    href={`/post?id=${encodeURIComponent(post.id)}`}
                                    className="text-xs text-[#1d9bf0] hover:underline"
                                >
                                    投稿を開く
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
                {!localBlocked && !localMuted && !localBlockedBy && canViewPosts && postCount > 0 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
                        {hasPrevious ? (
                            <Link
                                href={`/user/${encodeURIComponent(handle)}?page=${page - 1}`}
                                className="rounded-full border border-border px-4 py-2 text-zinc-700"
                            >
                                前へ
                            </Link>
                        ) : (
                            <span className="rounded-full border border-border px-4 py-2 text-zinc-400">
                                前へ
                            </span>
                        )}
                        <span className="text-xs text-zinc-500">
                            {page} / {totalPages}
                        </span>
                        {hasNext ? (
                            <Link
                                href={`/user/${encodeURIComponent(handle)}?page=${page + 1}`}
                                className="rounded-full border border-border px-4 py-2 text-zinc-700"
                            >
                                次へ
                            </Link>
                        ) : (
                            <span className="rounded-full border border-border px-4 py-2 text-zinc-400">
                                次へ
                            </span>
                        )}
                    </div>
                )}
                {posts.length === 0 && !localBlocked && !localMuted && !localBlockedBy && canViewPosts && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
