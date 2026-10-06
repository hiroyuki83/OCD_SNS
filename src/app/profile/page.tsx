import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { formatPostTime } from '@/lib/formatTime';
import HashtagText from '@/components/shared/HashtagText';
import { visibleAccountFilter } from '@/lib/accountStatus';
import PaginationLinks from '@/components/shared/PaginationLinks';
import { clampPage, parsePageNumber } from '@/lib/pagination';
import { DeletePostForm, PrivacyToggleForm } from '@/components/profile/ProfileDangerActions';
import ProfilePostActionForm from '@/components/profile/ProfilePostActionForm';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({
    searchParams,
}: {
    searchParams?: { page?: string };
}) {
    const session = await auth();
    if (!session?.user) redirect('/login');

    let userId: string | null = session.user.id ?? null;
    const sessionEmail = session.user.email;
    if (!userId && sessionEmail) {
        const user = await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: { id: true, name: true, email: true },
        });
        userId = user?.id ?? null;
    }
    if (!userId) redirect('/login');

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, handle: true, bio: true, avatarUrl: true, headerUrl: true, isPrivate: true },
    });

    if (!user) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                アカウント情報を取得できませんでした。{' '}
                <Link href="/login" className="text-[#1d9bf0] hover:underline">
                    ログインし直す
                </Link>
                ことをお試しください。
            </div>
        );
    }

    const now = new Date();
    const postCount = await prisma.post.count({
        where: { authorId: userId, deletedAt: null, isHidden: false },
    });
    const postPagination = clampPage(
        parsePageNumber(searchParams?.page),
        postCount,
        50,
    );

    const [posts, followerCount, followingCount, pendingFollowingCount, pendingFollowRequestCount, blockCount, muteCount] = await Promise.all([
        prisma.post.findMany({
            where: { authorId: userId, deletedAt: null, isHidden: false },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: postPagination.skip,
            take: postPagination.pageSize,
            select: {
                id: true,
                content: true,
                createdAt: true,
                wakaruCount: true,
                ganbattaCount: true,
                likes: { where: { userId }, select: { id: true } },
                bookmarks: { where: { userId }, select: { id: true } },
                reactions: { where: { userId }, select: { type: true } },
                _count: { select: { likes: true, bookmarks: true } },
            },
        }),
        prisma.follow.count({
            where: {
                followingId: userId,
                acceptedAt: { not: null },
                follower: visibleAccountFilter(now),
            },
        }),
        prisma.follow.count({
            where: {
                followerId: userId,
                acceptedAt: { not: null },
                following: visibleAccountFilter(now),
            },
        }),
        prisma.follow.count({
            where: {
                followerId: userId,
                acceptedAt: null,
                following: visibleAccountFilter(now),
            },
        }),
        prisma.follow.count({
            where: {
                followingId: userId,
                acceptedAt: null,
                follower: visibleAccountFilter(now),
            },
        }),
        prisma.block.count({
            where: { blockerId: userId },
        }),
        prisma.mute.count({
            where: { muterId: userId },
        }),
    ]);

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
                    <div className="-mt-10">
                        {user.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="プロフィール画像"
                                className="w-20 h-20 rounded-full border-4 border-black object-cover"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-slate-400 border-4 border-black" />
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-lg font-bold">{user.name ?? 'ユーザー'}</span>
                        <span className="text-sm text-zinc-500">@{user.handle}</span>
                        {user.bio && <p className="text-sm text-zinc-600">{user.bio}</p>}
                        <div className="flex gap-4 text-sm text-zinc-400 mt-2" />
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-2">
                        {user && (
                            <PrivacyToggleForm
                                isPrivate={user.isPrivate}
                                pendingRequestCount={pendingFollowRequestCount}
                            />
                        )}
                        <Link href="/profile/followers" className="text-xs text-[#1d9bf0] hover:underline">
                            フォロワー {followerCount}
                            {pendingFollowRequestCount > 0 ? `（承認待ち ${pendingFollowRequestCount}）` : ''}
                        </Link>
                        <Link href="/profile/following" className="text-xs text-[#1d9bf0] hover:underline">
                            フォロー {followingCount}
                            {pendingFollowingCount > 0 ? `（申請中 ${pendingFollowingCount}）` : ''}
                        </Link>
                        <Link href="/profile/mutes" className="text-xs text-[#1d9bf0] hover:underline">
                            ミュート {muteCount}
                        </Link>
                        <Link href="/profile/blocks" className="text-xs text-[#1d9bf0] hover:underline">
                            ブロック {blockCount}
                        </Link>
                    </div>
                </div>
            </div>
            <div className="flex flex-col">
                {postCount > 0 && (
                    <div className="px-4 py-2 text-xs text-zinc-500 border-b border-border">
                        投稿 {postCount}件・{postPagination.page}/{postPagination.totalPages}ページ
                    </div>
                )}
                {posts.map((post) => {
                    const liked = post.likes.length > 0;
                    const likeCount = post._count.likes;
                    const bookmarked = post.bookmarks.length > 0;
                    const wakaruReacted = post.reactions.some((reaction) => reaction.type === 'WAKARU');
                    const ganbattaReacted = post.reactions.some((reaction) => reaction.type === 'GANBATTA');

                    return (
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
                            <div className="flex items-center gap-3 text-zinc-500 flex-wrap relative z-30 feed-action-area">
                                <ProfilePostActionForm
                                    postId={post.id}
                                    action="like"
                                    active={liked}
                                    count={likeCount}
                                />
                                <ProfilePostActionForm
                                    postId={post.id}
                                    action="wakaru"
                                    active={wakaruReacted}
                                    count={post.wakaruCount}
                                />
                                <ProfilePostActionForm
                                    postId={post.id}
                                    action="ganbatta"
                                    active={ganbattaReacted}
                                    count={post.ganbattaCount}
                                />
                                <ProfilePostActionForm
                                    postId={post.id}
                                    action="bookmark"
                                    active={bookmarked}
                                    count={post._count.bookmarks}
                                />
                                <Link
                                    href={`/post/${encodeURIComponent(post.id)}`}
                                    className="text-xs text-[#1d9bf0] hover:underline"
                                >
                                    投稿を開く
                                </Link>
                                <DeletePostForm postId={post.id} />
                            </div>
                        </div>
                    </div>
                    );
                })}
                {postCount > 0 && (
                    <PaginationLinks
                        page={postPagination.page}
                        totalPages={postPagination.totalPages}
                        previousHref={postPagination.hasPrevious ? `/profile?page=${postPagination.page - 1}` : null}
                        nextHref={postPagination.hasNext ? `/profile?page=${postPagination.page + 1}` : null}
                    />
                )}
                {postCount === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
