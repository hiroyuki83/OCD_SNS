'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';
import { normalizeSearchQuery } from '@/lib/searchInput';
import { parsePageNumber } from '@/lib/pagination';
import PaginationLinks from '@/components/shared/PaginationLinks';

type SearchPost = {
    id: string;
    content: string;
    imageUrl: string | null;
    imageAlt: string | null;
    createdAt: string;
    author: {
        name: string | null;
        handle: string;
    };
};

export default function ExploreClient() {
    const searchParams = useSearchParams();
    const rawQuery = searchParams.get('q') ?? '';
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    const query = normalizedQuery.ok ? normalizedQuery.value : '';
    const queryError = normalizedQuery.ok ? null : normalizedQuery.error;
    const requestedPage = parsePageNumber(searchParams.get('page'));
    const [result, setResult] = useState<{
        query: string;
        requestedPage: number;
        posts: SearchPost[];
        totalCount: number;
        page: number;
        totalPages: number;
        hasPrevious: boolean;
        hasNext: boolean;
        error: boolean;
    }>({
        query: '',
        requestedPage: 1,
        posts: [],
        totalCount: 0,
        page: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
        error: false,
    });

    useEffect(() => {
        const currentResult = normalizeSearchQuery(searchParams.get('q') ?? '');
        if (!currentResult.ok || !currentResult.value) return;
        const current = currentResult.value;
        const currentPage = parsePageNumber(searchParams.get('page'));
        const controller = new AbortController();
        fetch(
            `/api/search-posts?q=${encodeURIComponent(current)}&page=${currentPage}`,
            {
                cache: 'no-store',
                credentials: 'include',
                signal: controller.signal,
            },
        )
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                if (controller.signal.aborted) return;
                setResult({
                    query: current,
                    requestedPage: currentPage,
                    posts: Array.isArray(data?.posts) ? data.posts : [],
                    totalCount: typeof data?.totalCount === 'number' ? data.totalCount : 0,
                    page: typeof data?.page === 'number' ? data.page : 1,
                    totalPages: typeof data?.totalPages === 'number' ? data.totalPages : 1,
                    hasPrevious: data?.hasPrevious === true,
                    hasNext: data?.hasNext === true,
                    error: false,
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setResult({
                    query: current,
                    requestedPage: currentPage,
                    posts: [],
                    totalCount: 0,
                    page: currentPage,
                    totalPages: 1,
                    hasPrevious: currentPage > 1,
                    hasNext: false,
                    error: true,
                });
            });
        return () => {
            controller.abort();
        };
    }, [searchParams]);

    const resultMatches = result.query === query && result.requestedPage === requestedPage;
    const isLoading = Boolean(query) && !resultMatches;
    const hasError = resultMatches && result.error;
    const posts = resultMatches ? result.posts : [];
    const totalCount = resultMatches ? result.totalCount : 0;
    const page = resultMatches ? result.page : requestedPage;
    const totalPages = resultMatches ? result.totalPages : 1;
    const hasPrevious = resultMatches && result.hasPrevious;
    const hasNext = resultMatches && result.hasNext;

    const searchHref = (nextPage: number) =>
        `/explore?q=${encodeURIComponent(query)}&page=${nextPage}`;

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="font-bold text-base">検索</h1>
                    {query && !queryError && (
                        <span className="text-xs text-zinc-500">
                            &ldquo;{query}&rdquo; の結果
                        </span>
                    )}
                </div>
                <form action="/explore" className="mt-3">
                    <input
                        key={rawQuery}
                        type="text"
                        name="q"
                        defaultValue={rawQuery}
                        maxLength={100}
                        placeholder="検索"
                        className="w-full rounded-full bg-zinc-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
                    />
                </form>
                {queryError && (
                    <div role="alert" className="mt-3 text-xs text-red-700">
                        {queryError}
                    </div>
                )}
                {query && !queryError && (
                    <div className="mt-3 flex gap-3 text-xs text-zinc-500">
                        <span aria-live="polite">
                            投稿 {totalCount}件・{page}/{totalPages}ページ
                        </span>
                    </div>
                )}
            </div>

            {!query && !queryError && (
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
                                    alt={post.imageAlt ?? ''}
                                    className="rounded-xl border border-border max-h-[320px] object-cover"
                                />
                            )}
                            <Link
                                href={`/post/${encodeURIComponent(post.id)}`}
                                className="text-xs font-semibold text-[#1d9bf0] hover:underline"
                            >
                                投稿を開く
                            </Link>
                        </div>
                    ))}
                    {!isLoading && !hasError && totalCount > 0 && (
                        <PaginationLinks
                            page={page}
                            totalPages={totalPages}
                            previousHref={hasPrevious ? searchHref(page - 1) : null}
                            nextHref={hasNext ? searchHref(page + 1) : null}
                        />
                    )}
                </div>
            )}

        </div>
    );
}
