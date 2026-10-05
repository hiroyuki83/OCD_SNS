'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import CreatePostForm from '@/components/feed/CreatePostForm';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';
import { promptForReport, submitReport } from '@/lib/reportClient';
import { DeletePostForm } from '@/components/profile/ProfileDangerActions';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { Bookmark, CircleDot, Heart, Plus, Sparkles, X } from 'lucide-react';

type FeedPost = {
    id: string;
    content: string;
    createdAt: string;
    wakaruCount: number;
    ganbattaCount: number;
    likeCount: number;
    bookmarkCount: number;
    liked: boolean;
    bookmarked: boolean;
    wakaruReacted: boolean;
    ganbattaReacted: boolean;
    author: {
        id: string;
        name: string | null;
        handle: string;
        avatarUrl: string | null;
    };
};

type FeedResponse = {
    posts: FeedPost[];
    viewerId: string | null;
    viewerAvatarUrl: string | null;
    totalCount: number;
    page: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
};

type AnnouncementNotice = {
    id: string;
    title: string;
    body: string;
    href: string | null;
};

export default function Feed({
    focusCompose = false,
    initialViewerId = null,
    initialViewerAvatarUrl = null,
    announcements = [],
}: {
    focusCompose?: boolean;
    initialViewerId?: string | null;
    initialViewerAvatarUrl?: string | null;
    announcements?: AnnouncementNotice[];
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
    const [tab, setTab] = useState<'for-you' | 'following'>(initialTab);
    const [data, setData] = useState<FeedResponse>({
        posts: [],
        viewerId: initialViewerId,
        viewerAvatarUrl: initialViewerAvatarUrl,
        totalCount: 0,
        page: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
    const [hasLoaded, setHasLoaded] = useState(false);
    const [reportingPostId, setReportingPostId] = useState<string | null>(null);
    const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
    const pendingPostActionKeys = useRef(new Set<string>());
    const [pendingPostActions, setPendingPostActions] = useState<Set<string>>(
        () => new Set(),
    );

    useEffect(() => {
        const nextTab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
        setTab(nextTab);
    }, [searchParams]);

    const fetchFeed = useMemo(
        () => async (signal?: AbortSignal) => {
            setStatus('loading');
            setData((prev) => ({
                ...prev,
                posts: [],
            }));
            try {
                const requestedPage =
                    tab === 'following' ? searchParams.get('page') ?? '1' : '1';
                const res = await fetch(
                    `/api/feed?tab=${encodeURIComponent(tab)}&page=${encodeURIComponent(requestedPage)}`,
                    {
                    cache: 'no-store',
                    credentials: 'include',
                        signal,
                    },
                );
                if (!res.ok) throw new Error('failed');
                const payload = await res.json();
                if (signal?.aborted) return;
                const viewerId = payload?.viewerId ?? null;
                const rawPosts = Array.isArray(payload?.posts) ? payload.posts : [];
                setData({
                    posts: rawPosts,
                    viewerId,
                    viewerAvatarUrl: payload?.viewerAvatarUrl ?? null,
                    totalCount: typeof payload?.totalCount === 'number' ? payload.totalCount : rawPosts.length,
                    page: typeof payload?.page === 'number' ? payload.page : 1,
                    totalPages: typeof payload?.totalPages === 'number' ? payload.totalPages : 1,
                    hasPrevious: Boolean(payload?.hasPrevious),
                    hasNext: Boolean(payload?.hasNext),
                });
                setStatus('idle');
                setHasLoaded(true);
            } catch {
                if (signal?.aborted) return;
                setData({
                    posts: [],
                    viewerId: null,
                    viewerAvatarUrl: null,
                    totalCount: 0,
                    page: 1,
                    totalPages: 1,
                    hasPrevious: false,
                    hasNext: false,
                });
                setStatus('error');
                setHasLoaded(true);
            }
        },
        [tab, searchParams],
    );

    useEffect(() => {
        const controller = new AbortController();
        fetchFeed(controller.signal);
        return () => {
            controller.abort();
        };
    }, [fetchFeed]);

    const applyLocalPostAction = (postId: string, action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark') => {
        setData((prev) => ({
            ...prev,
            posts: prev.posts.map((post) => {
                if (post.id !== postId) return post;
                if (action === 'like') {
                    const nextLiked = !post.liked;
                    return {
                        ...post,
                        liked: nextLiked,
                        likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)),
                    };
                }
                if (action === 'bookmark') {
                    const nextBookmarked = !post.bookmarked;
                    return {
                        ...post,
                        bookmarked: nextBookmarked,
                        bookmarkCount: Math.max(0, post.bookmarkCount + (nextBookmarked ? 1 : -1)),
                    };
                }
                if (action === 'wakaru') {
                    const nextWakaru = !post.wakaruReacted;
                    return {
                        ...post,
                        wakaruReacted: nextWakaru,
                        wakaruCount: Math.max(0, post.wakaruCount + (nextWakaru ? 1 : -1)),
                    };
                }
                const nextGanbatta = !post.ganbattaReacted;
                return {
                    ...post,
                    ganbattaReacted: nextGanbatta,
                    ganbattaCount: Math.max(0, post.ganbattaCount + (nextGanbatta ? 1 : -1)),
                };
            }),
        }));
    };

    const reconcileLocalPostAction = (
        postId: string,
        action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark',
        active: boolean,
        count: number | undefined,
    ) => {
        setData((prev) => ({
            ...prev,
            posts: prev.posts.map((post) => {
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
                        wakaruCount: typeof count === 'number' ? Math.max(0, count) : post.wakaruCount,
                    };
                }
                return {
                    ...post,
                    ganbattaReacted: active,
                    ganbattaCount:
                        typeof count === 'number' ? Math.max(0, count) : post.ganbattaCount,
                };
            }),
        }));
    };

    const runPostAction = async (postId: string, action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark') => {
        if (!data.viewerId || !postId || postId.length > 128) return;
        const actionKey = `${postId}:${action}`;
        if (pendingPostActionKeys.current.has(actionKey)) return;
        pendingPostActionKeys.current.add(actionKey);
        setPendingPostActions((prev) => {
            const next = new Set(prev);
            next.add(actionKey);
            return next;
        });
        applyLocalPostAction(postId, action);
        try {
            const res = await fetch('/api/post-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action }),
            });
            if (!res.ok) throw new Error('failed');
            const payload = await res.json();
            if (typeof payload?.active !== 'boolean') throw new Error('invalid response');
            reconcileLocalPostAction(
                postId,
                action,
                payload.active,
                typeof payload?.count === 'number' ? payload.count : undefined,
            );
        } catch {
            await fetchFeed();
        } finally {
            pendingPostActionKeys.current.delete(actionKey);
            setPendingPostActions((prev) => {
                const next = new Set(prev);
                next.delete(actionKey);
                return next;
            });
        }
    };

    const handleAction = (
        event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>,
        postId: string,
        action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark',
    ) => {
        event.stopPropagation();
        runPostAction(postId, action);
    };

    const reportPost = async (
        event: React.MouseEvent<HTMLButtonElement>,
        postId: string,
    ) => {
        event.stopPropagation();
        if (!data.viewerId || reportingPostId || !postId || postId.length > 128) return;

        const report = promptForReport();
        if (!report) return;

        setReportingPostId(postId);
        try {
            const result = await submitReport({ postId }, report);
            window.alert(result.message);
        } finally {
            setReportingPostId(null);
        }
    };

    return (
        <div className="flex-1 border-r border-border min-h-screen">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border">
                <div className="flex h-14">
                    <Link
                        href="/?tab=for-you"
                        className={`flex-1 flex items-center justify-center hover:bg-zinc-200/20 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors relative ${
                            tab === 'for-you' ? '' : 'text-zinc-500'
                        }`}
                    >
                        <span className={tab === 'for-you' ? 'font-bold text-sm' : 'font-medium text-sm'}>
                            おすすめ
                        </span>
                        {tab === 'for-you' && (
                            <div className="absolute bottom-0 w-14 h-1 bg-[#1d9bf0] rounded-full" />
                        )}
                    </Link>
                    <Link
                        href="/?tab=following"
                        className={`flex-1 flex items-center justify-center hover:bg-zinc-200/20 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors relative ${
                            tab === 'following' ? '' : 'text-zinc-500'
                        }`}
                    >
                        <span className={tab === 'following' ? 'font-bold text-sm' : 'font-medium text-sm'}>
                            フォロー中
                        </span>
                        {tab === 'following' && (
                            <div className="absolute bottom-0 w-14 h-1 bg-[#1d9bf0] rounded-full" />
                        )}
                    </Link>
                </div>
            </div>

            {announcements.length > 0 && (
                <div className="border-b border-border bg-sky-50/70">
                    {announcements.map((announcement) => (
                        <div key={announcement.id} className="px-4 py-3">
                            <div className="text-xs font-semibold text-sky-700">運営からのお知らせ</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-900">{announcement.title}</div>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700">
                                {announcement.body}
                            </p>
                            {announcement.href && (
                                <a
                                    href={announcement.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block text-sm font-semibold text-[#1d9bf0] hover:underline"
                                >
                                    詳しく見る
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {data.viewerId && (
                <CreatePostForm autoFocus={focusCompose} avatarUrl={data.viewerAvatarUrl} />
            )}
            {!data.viewerId && hasLoaded && (
                <div className="p-4 border-b border-border text-sm text-zinc-400">
                    ログインすると投稿できます。{' '}
                    <Link href="/login" className="text-[#1d9bf0] hover:underline">
                        ログイン
                    </Link>
                    してください。
                </div>
            )}

            <div className="flex flex-col">
                {status === 'error' && (
                    <div className="p-6 text-sm text-zinc-500 text-center">読み込みに失敗しました。</div>
                )}
                {data.posts.map((post) => {
                    const handle = post.author.handle;
                    const createdAt = formatPostTime(post.createdAt);

                    return (
                        <div
                            key={post.id}
                            className="p-4 border-b border-border hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors flex gap-4 relative"
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                                const target = event.target as HTMLElement;
                                if (target.closest('button') || target.closest('a') || target.closest('[data-action-area]')) {
                                    return;
                                }
                                router.push(`/post/${encodeURIComponent(post.id)}`);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    router.push(`/post/${encodeURIComponent(post.id)}`);
                                }
                            }}
                        >
                            <Link href={`/user/${handle}`} className="w-10 h-10 flex-shrink-0">
                                {post.author.avatarUrl ? (
                                    <img
                                        src={post.author.avatarUrl}
                                        alt="プロフィール画像"
                                        className="w-10 h-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-400" />
                                )}
                            </Link>
                            <div className="flex-1 flex flex-col gap-2 relative">
                                <div className="flex items-center justify-between gap-2 text-sm flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Link href={`/user/${handle}`} className="font-bold hover:underline">
                                            {post.author.name ?? 'ユーザー'}
                                        </Link>
                                        <Link href={`/user/${handle}`} className="text-zinc-500 hover:underline">
                                            @{handle}
                                        </Link>
                                        <span className="text-zinc-500">・</span>
                                        <span className="text-zinc-500">{createdAt}</span>
                                    </div>
                                    {null}
                                </div>
                                {post.content && <HashtagText text={post.content} className="text-sm" />}
                                <div
                                    className="relative mt-1 flex flex-wrap items-center justify-between gap-2 feed-action-area"
                                    data-action-area
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        {(post.likeCount > 0 || post.liked) && (
                                            data.viewerId ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => handleAction(event, post.id, 'like')}
                                                    aria-pressed={post.liked}
                                                    disabled={pendingPostActions.has(`${post.id}:like`)}
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
                                            data.viewerId ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => handleAction(event, post.id, 'wakaru')}
                                                    aria-pressed={post.wakaruReacted}
                                                    disabled={pendingPostActions.has(`${post.id}:wakaru`)}
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
                                            data.viewerId ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => handleAction(event, post.id, 'ganbatta')}
                                                    aria-pressed={post.ganbattaReacted}
                                                    disabled={pendingPostActions.has(`${post.id}:ganbatta`)}
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

                                        {data.viewerId && (
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

                                    <div className="ml-auto flex items-center gap-1">
                                        {data.viewerId ? (
                                            <button
                                                type="button"
                                                onClick={(event) => handleAction(event, post.id, 'bookmark')}
                                                aria-pressed={post.bookmarked}
                                                disabled={pendingPostActions.has(`${post.id}:bookmark`)}
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
                                        ) : null}

                                        {data.viewerId && post.author.id === data.viewerId && (
                                            <DeletePostForm postId={post.id} />
                                        )}
                                        {data.viewerId && post.author.id !== data.viewerId && (
                                            <button
                                                type="button"
                                                onClick={(event) => reportPost(event, post.id)}
                                                className="rounded-full px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-red-500"
                                                disabled={reportingPostId === post.id}
                                            >
                                                {reportingPostId === post.id ? '送信中' : '通報'}
                                            </button>
                                        )}
                                    </div>

                                    {reactionPickerPostId === post.id && data.viewerId && (
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
                                                            handleAction(event, post.id, 'like');
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
                                                            handleAction(event, post.id, 'wakaru');
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
                                                            handleAction(event, post.id, 'ganbatta');
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
                    );
                })}
                {status === 'idle' && tab === 'following' && data.totalCount > 0 && (
                    <div className="px-4 py-2 text-xs text-zinc-500 border-b border-border">
                        フォロー中の投稿 {data.totalCount}件
                    </div>
                )}
                {status === 'idle' && data.posts.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">
                        {tab === 'following'
                            ? 'フォロー中の投稿がありません'
                            : '投稿がまだありません'}
                    </div>
                )}
                {status === 'idle' && tab === 'following' && data.totalCount > 0 && (
                    <PaginationLinks
                        page={data.page}
                        totalPages={data.totalPages}
                        previousHref={
                            data.hasPrevious
                                ? `/?tab=following&page=${data.page - 1}`
                                : null
                        }
                        nextHref={
                            data.hasNext
                                ? `/?tab=following&page=${data.page + 1}`
                                : null
                        }
                    />
                )}
            </div>
        </div>
    );
}
