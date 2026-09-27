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

type SearchUser = {
    id: string;
    handle: string;
    name: string | null;
    bio: string | null;
    avatarUrl: string | null;
    isPrivate: boolean;
};

type SearchState = {
    query: string;
    requestedPostPage: number;
    requestedUserPage: number;
    posts: SearchPost[];
    postTotalCount: number;
    postPage: number;
    postTotalPages: number;
    postHasPrevious: boolean;
    postHasNext: boolean;
    users: SearchUser[];
    userTotalCount: number;
    userPage: number;
    userTotalPages: number;
    userHasPrevious: boolean;
    userHasNext: boolean;
    error: boolean;
};

const EMPTY_STATE: SearchState = {
    query: '',
    requestedPostPage: 1,
    requestedUserPage: 1,
    posts: [],
    postTotalCount: 0,
    postPage: 1,
    postTotalPages: 1,
    postHasPrevious: false,
    postHasNext: false,
    users: [],
    userTotalCount: 0,
    userPage: 1,
    userTotalPages: 1,
    userHasPrevious: false,
    userHasNext: false,
    error: false,
};

export default function ExploreClient() {
    const searchParams = useSearchParams();
    const rawQuery = searchParams.get('q') ?? '';
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    const query = normalizedQuery.ok ? normalizedQuery.value : '';
    const queryError = normalizedQuery.ok ? null : normalizedQuery.error;
    const requestedPostPage = parsePageNumber(searchParams.get('page'));
    const requestedUserPage = parsePageNumber(searchParams.get('usersPage'));
    const [result, setResult] = useState<SearchState>(EMPTY_STATE);

    useEffect(() => {
        const currentResult = normalizeSearchQuery(searchParams.get('q') ?? '');
        if (!currentResult.ok || !currentResult.value) return;
        const current = currentResult.value;
        const postPage = parsePageNumber(searchParams.get('page'));
        const userPage = parsePageNumber(searchParams.get('usersPage'));
        const controller = new AbortController();

        Promise.all([
            fetch(
                `/api/search-posts?q=${encodeURIComponent(current)}&page=${postPage}`,
                {
                    cache: 'no-store',
                    credentials: 'include',
                    signal: controller.signal,
                },
            ),
            fetch(
                `/api/search-users?q=${encodeURIComponent(current)}&page=${userPage}`,
                {
                    cache: 'no-store',
                    credentials: 'include',
                    signal: controller.signal,
                },
            ),
        ])
            .then(async ([postResponse, userResponse]) => {
                if (!postResponse.ok || !userResponse.ok) throw new Error('search failed');
                return Promise.all([postResponse.json(), userResponse.json()]);
            })
            .then(([postData, userData]) => {
                if (controller.signal.aborted) return;
                setResult({
                    query: current,
                    requestedPostPage: postPage,
                    requestedUserPage: userPage,
                    posts: Array.isArray(postData?.posts) ? postData.posts : [],
                    postTotalCount:
                        typeof postData?.totalCount === 'number' ? postData.totalCount : 0,
                    postPage: typeof postData?.page === 'number' ? postData.page : 1,
                    postTotalPages:
                        typeof postData?.totalPages === 'number' ? postData.totalPages : 1,
                    postHasPrevious: postData?.hasPrevious === true,
                    postHasNext: postData?.hasNext === true,
                    users: Array.isArray(userData?.users) ? userData.users : [],
                    userTotalCount:
                        typeof userData?.totalCount === 'number' ? userData.totalCount : 0,
                    userPage: typeof userData?.page === 'number' ? userData.page : 1,
                    userTotalPages:
                        typeof userData?.totalPages === 'number' ? userData.totalPages : 1,
                    userHasPrevious: userData?.hasPrevious === true,
                    userHasNext: userData?.hasNext === true,
                    error: false,
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setResult({
                    ...EMPTY_STATE,
                    query: current,
                    requestedPostPage: postPage,
                    requestedUserPage: userPage,
                    postPage,
                    userPage,
                    postHasPrevious: postPage > 1,
                    userHasPrevious: userPage > 1,
                    error: true,
                });
            });

        return () => controller.abort();
    }, [searchParams]);

    const resultMatches =
        result.query === query &&
        result.requestedPostPage === requestedPostPage &&
        result.requestedUserPage === requestedUserPage;
    const isLoading = Boolean(query) && !resultMatches;
    const hasError = resultMatches && result.error;

    const posts = resultMatches ? result.posts : [];
    const users = resultMatches ? result.users : [];
    const postTotalCount = resultMatches ? result.postTotalCount : 0;
    const userTotalCount = resultMatches ? result.userTotalCount : 0;
    const postPage = resultMatches ? result.postPage : requestedPostPage;
    const userPage = resultMatches ? result.userPage : requestedUserPage;
    const postTotalPages = resultMatches ? result.postTotalPages : 1;
    const userTotalPages = resultMatches ? result.userTotalPages : 1;

    const postSearchHref = (nextPage: number) =>
        `/explore?q=${encodeURIComponent(query)}&page=${nextPage}&usersPage=${userPage}`;
    const userSearchHref = (nextPage: number) =>
        `/explore?q=${encodeURIComponent(query)}&page=${postPage}&usersPage=${nextPage}`;

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
                    <label htmlFor="explore-search" className="sr-only">
                        投稿、ユーザー、@handle、ハッシュタグを検索
                    </label>
                    <input
                        id="explore-search"
                        key={rawQuery}
                        type="search"
                        name="q"
                        defaultValue={rawQuery}
                        maxLength={100}
                        placeholder="投稿、ユーザー、@handle、#ハッシュタグを検索"
                        autoComplete="off"
                        className="w-full rounded-full bg-zinc-100 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
                    />
                </form>
                {queryError && (
                    <div role="alert" className="mt-3 text-xs text-red-700">
                        {queryError}
                    </div>
                )}
                {query && !queryError && (
                    <div className="mt-3 text-xs text-zinc-500" aria-live="polite">
                        ユーザー {userTotalCount}件・投稿 {postTotalCount}件
                    </div>
                )}
            </div>

            {!query && !queryError && (
                <div className="p-6 text-sm text-zinc-500">
                    投稿、ユーザー、@handle、ハッシュタグを検索できます。
                </div>
            )}

            {query && (
                <div className="p-4 space-y-6">
                    {isLoading && (
                        <div className="text-sm text-zinc-500" role="status">
                            読み込み中...
                        </div>
                    )}
                    {hasError && (
                        <div className="text-sm text-zinc-500" role="alert">
                            検索に失敗しました
                        </div>
                    )}

                    {!isLoading && !hasError && (
                        <>
                            <section aria-labelledby="search-users-heading">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 id="search-users-heading" className="text-sm font-bold text-zinc-500">
                                        ユーザー
                                    </h2>
                                    {userTotalCount > 0 && (
                                        <span className="text-xs text-zinc-400">
                                            {userPage}/{userTotalPages}ページ
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {users.length === 0 && (
                                        <div className="text-sm text-zinc-500">
                                            ユーザーが見つかりません
                                        </div>
                                    )}
                                    {users.map((user) => (
                                        <Link
                                            key={user.id}
                                            href={`/user/${encodeURIComponent(user.handle)}`}
                                            className="flex items-start gap-3 rounded-2xl border border-border p-3 hover:bg-zinc-50"
                                        >
                                            {user.avatarUrl ? (
                                                <img
                                                    src={user.avatarUrl}
                                                    alt=""
                                                    className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div
                                                    className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-400"
                                                    aria-hidden="true"
                                                />
                                            )}
                                            <span className="min-w-0">
                                                <span className="flex flex-wrap items-center gap-2 text-sm">
                                                    <strong>{user.name ?? 'ユーザー'}</strong>
                                                    <span className="text-zinc-500">@{user.handle}</span>
                                                    {user.isPrivate && (
                                                        <span className="text-xs text-zinc-400">非公開</span>
                                                    )}
                                                </span>
                                                {user.bio && (
                                                    <span className="mt-1 block text-sm text-zinc-600">
                                                        {user.bio}
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                                {userTotalCount > 0 && (
                                    <PaginationLinks
                                        page={userPage}
                                        totalPages={userTotalPages}
                                        previousHref={
                                            result.userHasPrevious
                                                ? userSearchHref(userPage - 1)
                                                : null
                                        }
                                        nextHref={
                                            result.userHasNext
                                                ? userSearchHref(userPage + 1)
                                                : null
                                        }
                                    />
                                )}
                            </section>

                            <section aria-labelledby="search-posts-heading">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 id="search-posts-heading" className="text-sm font-bold text-zinc-500">
                                        投稿
                                    </h2>
                                    {postTotalCount > 0 && (
                                        <span className="text-xs text-zinc-400">
                                            {postPage}/{postTotalPages}ページ
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {posts.length === 0 && (
                                        <div className="text-sm text-zinc-500">
                                            投稿が見つかりません
                                        </div>
                                    )}
                                    {posts.map((post) => (
                                        <div
                                            key={post.id}
                                            className="border border-border rounded-2xl p-4 flex flex-col gap-3"
                                        >
                                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                                <Link
                                                    href={`/user/${encodeURIComponent(post.author.handle)}`}
                                                    className="font-bold text-zinc-900 hover:underline"
                                                >
                                                    {post.author.name ?? 'ユーザー'}
                                                </Link>
                                                <Link
                                                    href={`/user/${encodeURIComponent(post.author.handle)}`}
                                                    className="hover:underline"
                                                >
                                                    @{post.author.handle}
                                                </Link>
                                                <span>・</span>
                                                <span>{formatPostTime(post.createdAt)}</span>
                                            </div>
                                            <HashtagText
                                                text={post.content}
                                                className="text-sm leading-relaxed"
                                            />
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
                                </div>
                                {postTotalCount > 0 && (
                                    <PaginationLinks
                                        page={postPage}
                                        totalPages={postTotalPages}
                                        previousHref={
                                            result.postHasPrevious
                                                ? postSearchHref(postPage - 1)
                                                : null
                                        }
                                        nextHref={
                                            result.postHasNext
                                                ? postSearchHref(postPage + 1)
                                                : null
                                        }
                                    />
                                )}
                            </section>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
