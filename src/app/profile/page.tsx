import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { formatPostTime } from '@/lib/formatTime';
import { addGanbatta, addWakaru, deletePost, toggleBookmark, toggleLike, togglePrivateAccount } from '@/app/lib/actions';
import HashtagText from '@/components/shared/HashtagText';

export default async function ProfilePage() {
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, name: true, email: true },
        });
        userId = user?.id ?? null;
    }

    if (!session?.user || !userId) {
        return (
            <div className="p-6 text-sm text-zinc-400">
                プロフィールを見るには <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link> が必要です
            </div>
        );
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, bio: true, avatarUrl: true, headerUrl: true, isPrivate: true },
    });

    const [posts] = await Promise.all([
        prisma.post.findMany({
            where: { authorId: userId },
            orderBy: { createdAt: 'desc' },
            include: { likes: true, bookmarks: true, reactions: true },
        }),
    ]);

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">プロフィール</h1>
            </div>
            <div className="border-b border-border">
                <div className="h-32 bg-zinc-900">
                    {user?.headerUrl && (
                        <img src={user.headerUrl} alt="ヘッダー画像" className="h-32 w-full object-cover" />
                    )}
                </div>
                <div className="p-4 flex items-start justify-between gap-4">
                    <div className="-mt-10">
                        {user?.avatarUrl ? (
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
                        <span className="text-lg font-bold">{user?.name ?? 'ユーザー'}</span>
                        <span className="text-sm text-zinc-500">@{user?.email?.split('@')[0]}</span>
                        {user?.bio && <p className="text-sm text-zinc-300">{user.bio}</p>}
                        <div className="flex gap-4 text-sm text-zinc-400 mt-2" />
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-2">
                        <form action={togglePrivateAccount}>
                            <button
                                type="submit"
                                className={`text-xs hover:underline ${
                                    user?.isPrivate ? 'text-red-500' : 'text-[#1d9bf0]'
                                }`}
                            >
                                {user?.isPrivate ? '鍵を外す' : '鍵をかける'}
                            </button>
                        </form>
                        <Link href="/profile/following" className="text-xs text-[#1d9bf0] hover:underline">
                            フォロー一覧
                        </Link>
                        <Link href="/profile/mutes" className="text-xs text-[#1d9bf0] hover:underline">
                            ミュート一覧
                        </Link>
                        <Link href="/profile/blocks" className="text-xs text-[#1d9bf0] hover:underline">
                            ブロック一覧
                        </Link>
                    </div>
                </div>
            </div>
            <div className="flex flex-col">
                {posts.map((post) => {
                    const liked = !!userId && post.likes.some((like) => like.userId === userId);
                    const likeCount = post.likes.length;
                    const bookmarked = !!userId && post.bookmarks.some((bookmark) => bookmark.userId === userId);
                    const wakaruReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'WAKARU');
                    const ganbattaReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'GANBATTA');

                    return (
                        <div
                            key={post.id}
                            className="p-4 border-b border-border hover:bg-zinc-50 transition-colors flex gap-4 relative"
                        >
                            <Link
                                href={`/post?id=${post.id}`}
                                className="absolute inset-0 z-0 pointer-events-none"
                                aria-label="投稿を開く"
                            />
                            {user?.avatarUrl ? (
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
                                <span className="font-bold">{user?.name ?? 'ユーザー'}</span>
                                <span className="text-zinc-500">@{user?.email?.split('@')[0]}</span>
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
                            <div className="flex items-center gap-3 text-zinc-500 flex-wrap relative z-30 feed-action-area">
                                <form action={toggleLike.bind(null, post.id)}>
                                    <button
                                        type="submit"
                                        className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors ${
                                            liked ? 'text-red-500' : 'hover:text-red-500'
                                        }`}
                                    >
                                        いいね
                                        <span>{likeCount}</span>
                                    </button>
                                </form>
                                <form action={addWakaru.bind(null, post.id)}>
                                    <button
                                        type="submit"
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                            wakaruReacted ? 'text-yellow-400' : 'hover:text-yellow-400'
                                        }`}
                                    >
                                        わかる <span>{post.wakaruCount}</span>
                                    </button>
                                </form>
                                <form action={addGanbatta.bind(null, post.id)}>
                                    <button
                                        type="submit"
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                            ganbattaReacted ? 'text-green-400' : 'hover:text-green-400'
                                        }`}
                                    >
                                        頑張った！ <span>{post.ganbattaCount}</span>
                                    </button>
                                </form>
                                <form action={toggleBookmark.bind(null, post.id)}>
                                    <button
                                        type="submit"
                                        className={`text-xs rounded-full px-3 py-1 transition-colors ${
                                            bookmarked ? 'text-blue-400' : 'hover:text-blue-400'
                                        }`}
                                    >
                                        ブックマーク <span>{post.bookmarks.length}</span>
                                    </button>
                                </form>
                                <form action={deletePost.bind(null, post.id)}>
                                    <button type="submit" className="text-xs text-red-500 hover:underline">
                                        削除
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                    );
                })}
                {posts.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
