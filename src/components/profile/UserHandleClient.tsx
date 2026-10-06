'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';
import { promptForReport, submitReport } from '@/lib/reportClient';
import { parsePageNumber } from '@/lib/pagination';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { Bookmark, CircleDot, Heart, Plus, Sparkles, X } from 'lucide-react';

type ProfilePost = {
    id: string;
    content: string;
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

async function apiFailureMessage(response: Response, fallback: string) {
    try {
        const payload = await response.json();
        if (typeof payload?.error === 'string' && payload.error.trim()) {
            return payload.error;
        }
    } catch {
        // Use the fallback message.
    }
    if (response.status === 409) return '同時に別の操作が行われました。もう一度お試しください。';
    if (response.status === 403) return 'この操作は現在の関係では実行できません。';
    if (response.status === 404) return '対象のユーザーまたは投稿が見つかりません。';
    return fallback;
}

type ProfileResponse = {
    user: {
        id: string;
        name: string | null;
        handle: string;
        bio: string | null;
        avatarUrl: string | null;
        headerUrl: string | null;
        isPrivate?: boolean;
        followerCount?: number;
        followingCount?: number;
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
    const searchParams = useSearchParams();
    const rawHandle = useMemo(() => {
        const value = params?.handle;
        return Array.isArray(value) ? value[0] ?? '' : (value ?? '');
    }, [params]);
    const handle = useMemo(() => {
        const trimmed = rawHandle.trim();
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    }, [rawHandle]);
    const requestedPage = parsePageNumber(searchParams.get('page'));

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
    const [relationMessage, setRelationMessage] = useState<string | null>(null);
    const [postActionMessage, setPostActionMessage] = useState<string | null>(null);
    const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);

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
        setPostActionMessage(null);
        try {
            const res = await fetch('/api/post-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action }),
            });
            if (!res.ok) {
                setPostActionMessage(
                    await apiFailureMessage(res, '投稿への操作に失敗しました。'),
                );
                await fetchProfile();
                return;
            }
            const payload = await res.json();
            if (typeof payload?.active !== 'boolean') throw new Error('invalid response');
            reconcilePostAction(
                postId,
                action,
                payload.active,
                typeof payload?.count === 'number' ? payload.count : undefined,
            );
        } catch {
            setPostActionMessage('通信エラーのため操作を完了できませんでした。');
            await fetchProfile();
        } finally {
            setPendingPostAction(null);
        }
    };

    const reportUser = async () => {
        if (!profile?.viewerId || !profile.user.id || reportingUser) return;

        const report = promptForReport();
        if (!report) return;

        setReportingUser(true);
        try {
            const result = await submitReport({ targetUserId: profile.user.id }, report);
            window.alert(result.message);
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
        setRelationMessage(null);
        const action = localFollowing || localFollowPending ? 'unfollow' : 'follow';
        try {
            const res = await fetch('/api/follow-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action }),
            });
            if (!res.ok) {
                setRelationMessage(await apiFailureMessage(res, 'フォロー操作に失敗しました。'));
                return;
            }
            const payload = await res.json();
            setRelationMessage(
                action === 'unfollow'
                    ? 'フォローを解除しました。'
                    : payload?.followState === 'PENDING'
                      ? 'フォロー申請を送信しました。'
                      : 'フォローしました。',
            );
            await fetchProfile();
        } catch {
            setRelationMessage('通信エラーのためフォロー操作を完了できませんでした。');
        } finally {
            setPendingRelationAction(null);
        }
    };

    const toggleBlock = async () => {
        if (!viewerId || pendingRelationAction) return;
        if (
            !localBlocked &&
            !window.confirm(
                'このユーザーをブロックしますか？相互のフォロー関係が解除され、互いの通知も削除されます。',
            )
        ) {
            return;
        }

        setPendingRelationAction('block');
        setRelationMessage(null);
        const action = localBlocked ? 'unblock' : 'block';
        try {
            const res = await fetch('/api/block-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action }),
            });
            if (!res.ok) {
                setRelationMessage(await apiFailureMessage(res, 'ブロック操作に失敗しました。'));
                return;
            }
            setLocalBlocked(action === 'block');
            if (action === 'block') {
                setLocalFollowing(false);
                setLocalFollowPending(false);
            }
            setRelationMessage(action === 'block' ? 'ブロックしました。' : 'ブロックを解除しました。');
            await fetchProfile();
        } catch {
            setRelationMessage('通信エラーのためブロック操作を完了できませんでした。');
        } finally {
            setPendingRelationAction(null);
        }
    };

    const toggleMute = async () => {
        if (!viewerId || pendingRelationAction) return;
        setPendingRelationAction('mute');
        setRelationMessage(null);
        const action = localMuted ? 'unmute' : 'mute';
        try {
            const res = await fetch('/api/mute-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, action }),
            });
            if (!res.ok) {
                setRelationMessage(await apiFailureMessage(res, 'ミュート操作に失敗しました。'));
                return;
            }
            setLocalMuted(action === 'mute');
            setRelationMessage(action === 'mute' ? 'ミュートしました。' : 'ミュートを解除しました。');
            await fetchProfile();
        } catch {
            setRelationMessage('通信エラーのためミュート操作を完了できませんでした。');
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
                            {viewerId === user.id &&
                                typeof user.followingCount === 'number' &&
                                typeof user.followerCount === 'number' && (
                                    <div className="mt-1 flex gap-4 text-xs text-zinc-500">
                                        <span>フォロー {user.followingCount}</span>
                                        <span>フォロワー {user.followerCount}</span>
                                    </div>
                                )}
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
                                className={`text-xs ${localMuted ? 'text-zinc-500' : 'text-[#1d9bf0]'} hover:underline disabled:opacity-50`}
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
                {(relationMessage || postActionMessage) && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="px-4 pb-3 text-xs text-zinc-600"
                    >
                        {relationMessage ?? postActionMessage}
                    </div>
                )}
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
                        <div className="flex-1 flex flex-col gap-2 relative">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold">{user.name ?? 'ユーザー'}</span>
                                <span className="text-zinc-500">@{user.handle}</span>
                                <span className="text-zinc-500">・</span>
                                <span className="text-zinc-500">{formatPostTime(post.createdAt)}</span>
                            </div>
                            {post.content && <HashtagText text={post.content} className="text-sm" />}
                            <div className="relative mt-1 flex flex-wrap items-center justify-between gap-2 feed-action-area">
                                <div className="flex flex-wrap items-center gap-2">
                                    {(post.likeCount > 0 || post.liked) && (
                                        viewerId ? (
                                            <button
                                                type="button"
                                                onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'like'); }}
                                                aria-pressed={post.liked}
                                                disabled={pendingPostAction !== null}
                                                className={
                                                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 ' +
                                                    (post.liked
                                                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-sky-50 hover:text-sky-700')
                                                }
                                            >
                                                <Heart
                                                    className="h-4 w-4 text-sky-500"
                                                    fill={post.liked ? 'currentColor' : 'none'}
                                                />
                                                <span>いいね</span>
                                                <span className="tabular-nums text-zinc-500">{post.likeCount}</span>
                                            </button>
                                        ) : (
                                            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600">
                                                <Heart className="h-4 w-4 text-sky-500" />
                                                <span>いいね</span>
                                                <span className="tabular-nums">{post.likeCount}</span>
                                            </span>
                                        )
                                    )}

                                    {(post.wakaruCount > 0 || post.wakaruReacted) && (
                                        viewerId ? (
                                            <button
                                                type="button"
                                                onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'wakaru'); }}
                                                aria-pressed={post.wakaruReacted}
                                                disabled={pendingPostAction !== null}
                                                className={
                                                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 ' +
                                                    (post.wakaruReacted
                                                        ? 'border-teal-200 bg-teal-50 text-teal-700'
                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-teal-50 hover:text-teal-700')
                                                }
                                            >
                                                <CircleDot className="h-4 w-4 text-teal-500" />
                                                <span>わかる</span>
                                                <span className="tabular-nums text-zinc-500">{post.wakaruCount}</span>
                                            </button>
                                        ) : (
                                            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600">
                                                <CircleDot className="h-4 w-4 text-teal-500" />
                                                <span>わかる</span>
                                                <span className="tabular-nums">{post.wakaruCount}</span>
                                            </span>
                                        )
                                    )}

                                    {(post.ganbattaCount > 0 || post.ganbattaReacted) && (
                                        viewerId ? (
                                            <button
                                                type="button"
                                                onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'ganbatta'); }}
                                                aria-pressed={post.ganbattaReacted}
                                                disabled={pendingPostAction !== null}
                                                className={
                                                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50 ' +
                                                    (post.ganbattaReacted
                                                        ? 'border-orange-200 bg-orange-50 text-orange-700'
                                                        : 'border-zinc-200 bg-white text-zinc-600 hover:bg-orange-50 hover:text-orange-700')
                                                }
                                            >
                                                <Sparkles className="h-4 w-4 text-orange-500" />
                                                <span>応援</span>
                                                <span className="tabular-nums text-zinc-500">{post.ganbattaCount}</span>
                                            </button>
                                        ) : (
                                            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-600">
                                                <Sparkles className="h-4 w-4 text-orange-500" />
                                                <span>応援</span>
                                                <span className="tabular-nums">{post.ganbattaCount}</span>
                                            </span>
                                        )
                                    )}

                                    {viewerId && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setReactionPickerPostId(post.id);
                                            }}
                                            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-sky-600"
                                            aria-label="リアクションを追加"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="ml-auto flex items-center gap-2">
                                    {viewerId && (
                                        <button
                                            type="button"
                                            onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'bookmark'); }}
                                            aria-pressed={post.bookmarked}
                                            disabled={pendingPostAction !== null}
                                            className={
                                                'flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-50 ' +
                                                (post.bookmarked
                                                    ? 'bg-sky-50 text-sky-600'
                                                    : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700')
                                            }
                                            aria-label={post.bookmarked ? 'ブックマーク済み' : 'ブックマーク'}
                                            title="ブックマーク"
                                        >
                                            <Bookmark
                                                className="h-4 w-4"
                                                fill={post.bookmarked ? 'currentColor' : 'none'}
                                            />
                                        </button>
                                    )}
                                    <Link
                                        href={`/post/${encodeURIComponent(post.id)}`}
                                        className="text-xs text-[#1d9bf0] hover:underline"
                                    >
                                        投稿を開く
                                    </Link>
                                </div>

                                {reactionPickerPostId === post.id && viewerId && (
                                    <>
                                        <button
                                            type="button"
                                            className="fixed inset-0 z-[100] bg-black/25"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setReactionPickerPostId(null);
                                            }}
                                            aria-label="リアクションメニューを閉じる"
                                        />
                                        <div
                                            className="fixed inset-x-0 bottom-0 z-[110] isolate mx-auto w-full max-w-md rounded-t-3xl border border-zinc-200 bg-white p-4 shadow-2xl md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:rounded-3xl"
                                            onClick={(event) => event.stopPropagation()}
                                        >
                                            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 md:hidden" />
                                            <div className="mb-3 flex items-center justify-between">
                                                <div>
                                                    <div className="text-base font-bold text-zinc-900">反応する</div>
                                                    <div className="mt-0.5 text-xs text-zinc-500">
                                                        投稿をどう受け取ったかを、そっと伝えられます。
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setReactionPickerPostId(null)}
                                                    className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100"
                                                    aria-label="閉じる"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        runPostAction(post.id, 'like');
                                                        setReactionPickerPostId(null);
                                                    }}
                                                    className={
                                                        'flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors ' +
                                                        (post.liked
                                                            ? 'border-sky-200 bg-sky-50'
                                                            : 'border-zinc-200 hover:bg-zinc-50')
                                                    }
                                                >
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-500">
                                                        <Heart className="h-5 w-5" fill={post.liked ? 'currentColor' : 'none'} />
                                                    </span>
                                                    <span>
                                                        <span className="block text-sm font-bold text-zinc-900">いいね</span>
                                                        <span className="block text-xs text-zinc-500">素敵な投稿だと思ったときに</span>
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        runPostAction(post.id, 'wakaru');
                                                        setReactionPickerPostId(null);
                                                    }}
                                                    className={
                                                        'flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors ' +
                                                        (post.wakaruReacted
                                                            ? 'border-teal-200 bg-teal-50'
                                                            : 'border-zinc-200 hover:bg-zinc-50')
                                                    }
                                                >
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-500">
                                                        <CircleDot className="h-5 w-5" />
                                                    </span>
                                                    <span>
                                                        <span className="block text-sm font-bold text-zinc-900">わかる</span>
                                                        <span className="block text-xs text-zinc-500">気持ちに共感したときに</span>
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        runPostAction(post.id, 'ganbatta');
                                                        setReactionPickerPostId(null);
                                                    }}
                                                    className={
                                                        'flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors ' +
                                                        (post.ganbattaReacted
                                                            ? 'border-orange-200 bg-orange-50'
                                                            : 'border-zinc-200 hover:bg-zinc-50')
                                                    }
                                                >
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500">
                                                        <Sparkles className="h-5 w-5" />
                                                    </span>
                                                    <span>
                                                        <span className="block text-sm font-bold text-zinc-900">応援している</span>
                                                        <span className="block text-xs text-zinc-500">そっと背中を押したいときに</span>
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {!localBlocked && !localMuted && !localBlockedBy && canViewPosts && postCount > 0 && (
                    <PaginationLinks
                        page={page}
                        totalPages={totalPages}
                        previousHref={
                            hasPrevious
                                ? `/user/${encodeURIComponent(handle)}?page=${page - 1}`
                                : null
                        }
                        nextHref={
                            hasNext
                                ? `/user/${encodeURIComponent(handle)}?page=${page + 1}`
                                : null
                        }
                    />
                )}
                {posts.length === 0 && !localBlocked && !localMuted && !localBlockedBy && canViewPosts && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
