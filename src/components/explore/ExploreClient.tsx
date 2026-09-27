'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';

type SearchPost = {
    id: string;
    content: string;
    imageUrl: string | null;
    createdAt: string;
    author: {
        name: string | null;
        handle: string;
    };
};

export default function ExploreClient() {
    const searchParams = useSearchParams();
    const query = (searchParams.get('q')?.trim() ?? '').slice(0, 100);
    const [result, setResult] = useState<{
        query: string;
        posts: SearchPost[];
        error: boolean;
    }>({ query: '', posts: [], error: false });

    useEffect(() => {
        const current = (searchParams.get('q')?.trim() ?? '').slice(0, 100);
        if (!current) return;
        const controller = new AbortController();
        fetch(`/api/search-posts?q=${encodeURIComponent(current)}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                if (controller.signal.aborted) return;
                setResult({
                    query: current,
                    posts: Array.isArray(data?.posts) ? data.posts : [],
                    error: false,
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setResult({ query: current, posts: [], error: true });
            });
        return () => {
            controller.abort();
        };
    }, [searchParams]);

    const isLoading = Boolean(query) && result.query !== query;
    const hasError = result.query === query && result.error;
    const posts = result.query === query ? result.posts : [];

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-base">検索</h1>
                    {query && (
                        <span className="text-xs text-zinc-500">
                            &ldquo;{query}&rdquo; の結果
                        </span>
                    )}
                </div>
                <form action="/explore" className="mt-3">
                    <input
                        key={query}
                        type="text"
                        name="q"
                        defaultValue={query}
                        maxLength={100}
                        placeholder="検索"
                        className="w-full rounded-full bg-zinc-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
                    />
                </form>
                {query && (
                    <div className="mt-3 flex gap-3 text-xs text-zinc-500">
                        <span>投稿 {posts.length}件</span>
                    </div>
                )}
            </div>

            {!query && (
                <div className="p-6 text-sm text-zinc-500">
                    何かを検索してみましょう
                </div>
            )}

            {query && (
                <div className="p-4 space-y-3">
                    <h2 className="text-sm font-bold text-zinc-400">投稿</h2>
                    {isLoading && (
                        <div className="text-sm text-zinc-500">読み込み中...</div>
                    )}
                    {hasError && (
                        <div className="text-sm text-zinc-500">検索に失敗しました</div>
                    )}
                    {!isLoading && !hasError && posts.length === 0 && (
                        <div className="text-sm text-zinc-500">投稿が見つかりません</div>
                    )}
                    {posts.map((post) => (
                        <div
                            key={post.id}
                            className="border border-border rounded-2xl p-4 flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <Link
                                    href={`/user/${post.author.handle}`}
                                    className="font-bold text-zinc-900 hover:underline"
                                >
                                    {post.author.name ?? 'ユーザー'}
                                </Link>
                                <Link href={`/user/${post.author.handle}`} className="hover:underline">
                                    @{post.author.handle}
                                </Link>
                                <span>・</span>
                                <span>{formatPostTime(post.createdAt)}</span>
                            </div>
                            <HashtagText text={post.content} className="text-sm leading-relaxed" />
                            {post.imageUrl && (
                                <img
                                    src={post.imageUrl}
                                    alt="投稿画像"
                                    className="rounded-xl border border-border max-h-[320px] object-cover"
                                />
                            )}
                            <Link
                                href={`/post?id=${encodeURIComponent(post.id)}`}
                                className="text-xs font-semibold text-[#1d9bf0] hover:underline"
                            >
                                投稿を開く
                            </Link>
                        </div>
                    ))}
                </div>
            )}

        </div>
    );
}
