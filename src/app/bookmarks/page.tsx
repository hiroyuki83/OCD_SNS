import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { formatPostTime } from '@/lib/formatTime';
import HashtagText from '@/components/shared/HashtagText';
import { visibleAccountFilter } from '@/lib/accountStatus';
import type { Prisma } from '@prisma/client';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import ProfilePostActionForm from '@/components/profile/ProfilePostActionForm';

export const dynamic = 'force-dynamic';

export default async function BookmarksPage({
    searchParams,
}: {
    searchParams?: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    if (!session?.user || !userId) {
        return (
            <div className="p-6 text-sm text-zinc-400">
                ブックマークを見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const [blockedIds, blockedByIds, mutedIds] = await Promise.all([
        prisma.block.findMany({
            where: { blockerId: userId },
            select: { blockedId: true },
        }).then((rows) => rows.map((row) => row.blockedId)),
        prisma.block.findMany({
            where: { blockedId: userId },
            select: { blockerId: true },
        }).then((rows) => rows.map((row) => row.blockerId)),
        prisma.mute.findMany({
            where: { muterId: userId },
            select: { mutedId: true },
        }).then((rows) => rows.map((row) => row.mutedId)),
    ]);

    const excludedAuthorIds = Array.from(new Set([...blockedIds, ...blockedByIds, ...mutedIds]));

    const now = new Date();

    const bookmarkWhere: Prisma.BookmarkWhereInput = {
        userId,
        post: {
            isHidden: false,
            deletedAt: null,
            ...(excludedAuthorIds.length > 0 ? { authorId: { notIn: excludedAuthorIds } } : {}),
            author: {
                AND: [
                    visibleAccountFilter(now),
                    {
                        OR: [
                            { isPrivate: false },
                            { id: userId },
                            {
                                followers: {
                                    some: {
                                        followerId: userId,
                                        acceptedAt: { not: null },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        },
    };

    const bookmarkCount = await prisma.bookmark.count({ where: bookmarkWhere });
    const pagination = clampPage(
        parsePageNumber(params?.page),
        bookmarkCount,
        50,
    );

    const bookmarkRows = await prisma.bookmark.findMany({
        where: bookmarkWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
            id: true,
            post: {
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    authorId: true,
                    author: {
                        select: {
                            id: true,
                            name: true,
                            handle: true,
                            avatarUrl: true,
                            isPrivate: true,
                        },
                    },
                    _count: { select: { likes: true } },
                },
            },
        },
    });

    const bookmarks = bookmarkRows;

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">ブックマーク</h1>
            </div>
            <div className="flex flex-col">
                {bookmarkCount > 0 && (
                    <div className="px-4 py-2 text-xs text-zinc-500 border-b border-border">
                        全{bookmarkCount}件・{pagination.page}/{pagination.totalPages}ページ
                    </div>
                )}
                {bookmarks.map((entry) => {
                    const post = entry.post;
                    const createdAt = formatPostTime(post.createdAt);

                    return (
                        <div key={entry.id} className="p-4 border-b border-border flex gap-4">
                            {post.author.avatarUrl ? (
                                <img
                                    src={post.author.avatarUrl}
                                    alt="プロフィール画像"
                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                    <Link href={`/user/${post.author.handle}`} className="font-bold hover:underline">
                                        {post.author.name ?? 'ユーザー'}
                                    </Link>
                                    <Link href={`/user/${post.author.handle}`} className="text-zinc-500 hover:underline">
                                        @{post.author.handle}
                                    </Link>
                                    <span className="text-zinc-500">・</span>
                                    <span className="text-zinc-500">{createdAt}</span>
                                </div>
                                {post.content && <HashtagText text={post.content} className="text-sm" />}
                                <div className="flex items-center gap-3 text-zinc-500">
                                    <div className="text-xs">いいね {post._count.likes}</div>
                                    <Link
                                        href={`/post/${encodeURIComponent(post.id)}`}
                                        className="text-xs text-[#1d9bf0] hover:underline"
                                    >
                                        投稿を開く
                                    </Link>
                                    <ProfilePostActionForm
                                        postId={post.id}
                                        action="bookmark"
                                        active
                                        compactLabel="ブックマーク解除"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {bookmarkCount > 0 && (
                    <PaginationLinks
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        previousHref={pagination.hasPrevious ? `/bookmarks?page=${pagination.page - 1}` : null}
                        nextHref={pagination.hasNext ? `/bookmarks?page=${pagination.page + 1}` : null}
                    />
                )}
                {bookmarks.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">ブックマークはまだありません</div>
                )}
            </div>
        </div>
    );
}
