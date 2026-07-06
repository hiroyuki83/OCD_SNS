'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { deletePost } from '@/app/lib/actions';
import CreatePostForm from '@/components/feed/CreatePostForm';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';

type FeedPost = {
    id: string;
    content: string;
    imageUrl: string | null;
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
        email: string;
        avatarUrl: string | null;
    };
};

type FeedResponse = {
    posts: FeedPost[];
    followingIds: string[];
    viewerId: string | null;
    viewerAvatarUrl: string | null;
};

export default function Feed({
    focusCompose = false,
    initialViewerId = null,
    initialViewerAvatarUrl = null,
}: {
    focusCompose?: boolean;
    initialViewerId?: string | null;
    initialViewerAvatarUrl?: string | null;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialTab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
    const [tab, setTab] = useState<'for-you' | 'following'>(initialTab);
    const [data, setData] = useState<FeedResponse>({
        posts: [],
        followingIds: [],
        viewerId: initialViewerId,
        viewerAvatarUrl: initialViewerAvatarUrl,
    });
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
    const [hasLoaded, setHasLoaded] = useState(false);
    const [reportingPostId, setReportingPostId] = useState<string | null>(null);

    useEffect(() => {
        const nextTab = searchParams.get('tab') === 'following' ? 'following' : 'for-you';
        setTab(nextTab);
    }, [searchParams]);

    const fetchFeed = useMemo(
        () => async () => {
            setStatus('loading');
            setData((prev) => ({
                posts: [],
                followingIds: prev.followingIds,
                viewerId: prev.viewerId,
                viewerAvatarUrl: prev.viewerAvatarUrl,
            }));
            try {
                const res = await fetch(`/api/feed?tab=${encodeURIComponent(tab)}`, {
                    cache: 'no-store',
                    credentials: 'include',
                });
                if (!res.ok) throw new Error('failed');
                const payload = await res.json();
                const viewerId = payload?.viewerId ?? null;
                const rawPosts = Array.isArray(payload?.posts) ? payload.posts : [];
                const filteredPosts = rawPosts;
                setData({
                    posts: filteredPosts,
                    followingIds: Array.isArray(payload?.followingIds) ? payload.followingIds : [],
                    viewerId,
                    viewerAvatarUrl: payload?.viewerAvatarUrl ?? null,
                });
                setStatus('idle');
                setHasLoaded(true);
            } catch {
                setData({ posts: [], followingIds: [], viewerId: null, viewerAvatarUrl: null });
                setStatus('error');
                setHasLoaded(true);
            }
        },
        [tab],
    );

    useEffect(() => {
        let active = true;
        fetchFeed().catch(() => {
            if (active) setStatus('error');
        });
        return () => {
            active = false;
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

    const runPostAction = async (postId: string, action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark') => {
        if (!data.viewerId) return;
        if (tab === 'for-you') {
            applyLocalPostAction(postId, action);
        }
        try {
            const res = await fetch('/api/post-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, action }),
            });
            if (!res.ok) throw new Error('failed');
            if (tab === 'following') {
                await fetchFeed();
            }
        } catch {
            if (tab === 'for-you') {
                await fetchFeed();
            }
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
        if (!data.viewerId || reportingPostId) return;
        const detail = window.prompt('通報理由を入力してください。空欄でも送信できます。');
        if (detail === null) return;

        setReportingPostId(postId);
        try {
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ postId, reason: 'OTHER', detail }),
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
                    const handle = post.author.email.split('@')[0];
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
                                router.push(`/post?id=${post.id}`);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    router.push(`/post?id=${post.id}`);
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
                            <div className="flex-1 flex flex-col gap-2 relative z-10">
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
                                {post.imageUrl && (
                                    <img
                                        src={post.imageUrl}
                                        alt="投稿画像"
                                        className="mt-2 rounded-2xl border border-border max-h-[480px] object-cover"
                                    />
                                )}
                                <div className="flex items-center gap-3 text-zinc-500 flex-wrap relative z-30 feed-action-area" data-action-area>
                                    {data.viewerId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => handleAction(event, post.id, 'like')}
                                            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors ${
                                                post.liked ? 'text-red-500' : 'hover:text-red-500'
                                            }`}
                                        >
                                            いいね
                                            <span>{post.likeCount}</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs">いいね {post.likeCount}</div>
                                    )}
                                    {data.viewerId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => handleAction(event, post.id, 'wakaru')}
                                            className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                                post.wakaruReacted ? 'text-yellow-400' : 'hover:text-yellow-400'
                                            }`}
                                        >
                                            わかる <span>{post.wakaruCount}</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs">わかる {post.wakaruCount}</div>
                                    )}
                                    {data.viewerId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => handleAction(event, post.id, 'ganbatta')}
                                            className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                                post.ganbattaReacted ? 'text-green-400' : 'hover:text-green-400'
                                            }`}
                                        >
                                            頑張った <span>{post.ganbattaCount}</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs">頑張った {post.ganbattaCount}</div>
                                    )}
                                    {data.viewerId ? (
                                        <button
                                            type="button"
                                            onClick={(event) => handleAction(event, post.id, 'bookmark')}
                                            className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                                post.bookmarked ? 'text-blue-400' : 'hover:text-blue-400'
                                            }`}
                                        >
                                            ブックマーク <span>{post.bookmarkCount}</span>
                                        </button>
                                    ) : (
                                        <div className="text-xs">ブックマーク {post.bookmarkCount}</div>
                                    )}
                                    {data.viewerId && post.author.id === data.viewerId && (
                                        <form action={deletePost.bind(null, post.id)}>
                                            <button
                                                type="submit"
                                                className="text-xs text-red-500 hover:underline"
                                            >
                                                削除
                                            </button>
                                        </form>
                                    )}
                                    {data.viewerId && post.author.id !== data.viewerId && (
                                        <button
                                            type="button"
                                            onClick={(event) => reportPost(event, post.id)}
                                            className="text-xs text-zinc-500 hover:text-red-500"
                                            disabled={reportingPostId === post.id}
                                        >
                                            {reportingPostId === post.id ? '送信中' : '通報'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {status === 'idle' && data.posts.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">
                        {tab === 'following'
                            ? 'フォロー中の投稿がありません'
                            : '投稿がまだありません'}
                    </div>
                )}
            </div>
        </div>
    );
}
