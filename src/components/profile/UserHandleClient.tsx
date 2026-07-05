'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';

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
        email: string;
        bio: string | null;
        avatarUrl: string | null;
        headerUrl: string | null;
        isPrivate?: boolean;
    };
    posts: ProfilePost[];
    isFollowing: boolean;
    isBlocked: boolean;
    isMuted: boolean;
    isBlockedBy: boolean;
    viewerId: string | null;
};

export default function UserHandleClient() {
    const params = useParams();
    const router = useRouter();
    const rawHandle = useMemo(() => {
        const value = params?.handle;
        return Array.isArray(value) ? value[0] ?? '' : (value ?? '');
    }, [params]);
    const handle = useMemo(() => {
        const trimmed = rawHandle.trim();
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    }, [rawHandle]);

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
    const [localFollowing, setLocalFollowing] = useState(false);
    const [localBlocked, setLocalBlocked] = useState(false);
    const [localMuted, setLocalMuted] = useState(false);
    const [localBlockedBy, setLocalBlockedBy] = useState(false);

    const fetchProfile = useMemo(
        () => async () => {
            if (!handle) return;
            setStatus('loading');
            try {
                const res = await fetch(`/api/user-handle?handle=${encodeURIComponent(handle)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error('failed');
                const data = await res.json();
                if (!data?.user) throw new Error('not found');
                setProfile(data);
                setStatus('idle');
            } catch {
                setStatus('error');
            }
        },
        [handle],
    );

    useEffect(() => {
        let active = true;
        if (!handle) return;
        fetchProfile().catch(() => {
            if (active) setStatus('error');
        });
        return () => {
            active = false;
        };
    }, [handle, fetchProfile]);

    useEffect(() => {
        if (profile) {
            setLocalFollowing(profile.isFollowing);
            setLocalBlocked(profile.isBlocked);
            setLocalMuted(profile.isMuted);
            setLocalBlockedBy(profile.isBlockedBy);
        }
    }, [profile]);

    const runPostAction = async (postId: string, action: 'like' | 'wakaru' | 'ganbatta' | 'bookmark') => {
        await fetch('/api/post-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, action }),
        });
        await fetchProfile();
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

    const { user, posts, viewerId } = profile;
    const isPrivate = !!user.isPrivate;
    const canViewPosts = !isPrivate || viewerId === user.id || localFollowing;

    const toggleFollow = async () => {
        if (!viewerId) return;
        await fetch('/api/follow-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: user.id, action: localFollowing ? 'unfollow' : 'follow' }),
        });
        setLocalFollowing((prev) => !prev);
        await fetchProfile();
    };

    const toggleBlock = async () => {
        if (!viewerId) return;
        await fetch('/api/block-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: user.id, action: localBlocked ? 'unblock' : 'block' }),
        });
        setLocalBlocked((prev) => !prev);
        if (!localBlocked) {
            setLocalFollowing(false);
        }
        await fetchProfile();
    };

    const toggleMute = async () => {
        if (!viewerId) return;
        await fetch('/api/mute-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUserId: user.id, action: localMuted ? 'unmute' : 'mute' }),
        });
        setLocalMuted((prev) => !prev);
        await fetchProfile();
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
                            <span className="text-sm text-zinc-500">@{user.email.split('@')[0]}</span>
                            {user.bio && <p className="text-sm text-zinc-500">{user.bio}</p>}
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
                                    className="text-xs text-[#1d9bf0] hover:underline"
                                >
                                    {localFollowing ? 'フォロー中' : 'フォローする'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={toggleMute}
                                className={`text-xs ${localMuted ? 'text-zinc-500' : 'text-[#1d9bf0]'} hover:underline`}
                                disabled={localBlockedBy}
                            >
                                {localMuted ? 'ミュート解除' : 'ミュート'}
                            </button>
                            <button
                                type="button"
                                onClick={toggleBlock}
                                className={`text-xs ${localBlocked ? 'text-red-500' : 'text-[#1d9bf0]'} hover:underline`}
                            >
                                {localBlocked ? 'ブロック解除' : 'ブロック'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="flex flex-col">
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
                        このアカウントは非公開です。フォロー中のみ投稿を表示できます。
                    </div>
                )}
                {posts.map((post) => (
                    <div
                        key={post.id}
                        className="p-4 border-b border-border hover:bg-zinc-50 transition-colors flex gap-4 relative"
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
                        <Link
                            href={`/post?id=${post.id}`}
                            className="absolute inset-0 z-0 pointer-events-none"
                            aria-label="投稿を開く"
                        />
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
                                <span className="text-zinc-500">@{user.email.split('@')[0]}</span>
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
                                {viewerId ? (
                                    <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); runPostAction(post.id, 'wakaru'); }}
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
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
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
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
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                            post.bookmarked ? 'text-blue-400' : 'hover:text-blue-400'
                                        }`}
                                    >
                                        ブックマーク <span>{post.bookmarkCount}</span>
                                    </button>
                                ) : (
                                    <div className="text-xs">ブックマーク {post.bookmarkCount}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {posts.length === 0 && !localBlocked && !localMuted && !localBlockedBy && canViewPosts && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
