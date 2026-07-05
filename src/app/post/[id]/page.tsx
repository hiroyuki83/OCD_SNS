import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { formatPostTime } from '@/lib/formatTime';
import { addGanbatta, addWakaru, deletePost, toggleBookmark, toggleLike } from '@/app/lib/actions';
import type { Prisma } from '@prisma/client';
import HashtagText from '@/components/shared/HashtagText';

export default async function PostPage({ params }: { params?: { id?: string } }) {
    let postId = params?.id;
    if (!postId) {
        const headerList = await headers();
        const rawUrl =
            headerList.get('x-url') ??
            headerList.get('x-original-url') ??
            headerList.get('referer') ??
            '';
        if (rawUrl) {
            try {
                const parsed = new URL(rawUrl);
                const match = parsed.pathname.match(/^\/post\/([^/?#]+)/);
                postId = match?.[1];
            } catch {
                // ignore
            }
        }
    }
    if (!postId) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                投稿IDが取得できませんでした。
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }
    let session = null;
    let userId = undefined as string | undefined;
    type PostWithRelations = Prisma.PostGetPayload<{
        include: {
            author: true;
            likes: true;
            bookmarks: true;
            reactions: true;
        };
    }>;
    let post: PostWithRelations | null = null;
    let loadError: string | null = null;

    try {
        session = await auth();
        userId = session?.user?.id;
        post = await prisma.post.findUnique({
            where: { id: postId },
            include: {
                author: true,
                likes: true,
                bookmarks: true,
            reactions: true,
        },
    });
    } catch (error) {
        loadError = error instanceof Error ? error.message : String(error);
    }

    if (loadError) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                読み込み中にエラーが発生しました。<span className="text-zinc-400">{loadError}</span>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                投稿が見つかりませんでした。
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const liked = !!userId && post.likes.some((like) => like.userId === userId);
    const likeCount = post.likes.length;
    const bookmarked = !!userId && post.bookmarks.some((bookmark) => bookmark.userId === userId);
    const wakaruReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'WAKARU');
    const ganbattaReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'GANBATTA');
    const createdAt = formatPostTime(post.createdAt);
    const handle = post.author.email.split('@')[0];

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">投稿</h1>
            </div>
            <div className="p-4 border-b border-border flex gap-4">
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
                        <Link href={`/user/${handle}`} className="font-bold hover:underline">
                            {post.author.name ?? 'ユーザー'}
                        </Link>
                        <Link href={`/user/${handle}`} className="text-zinc-500 hover:underline">
                            @{handle}
                        </Link>
                        <span className="text-zinc-500">・</span>
                        <span className="text-zinc-500">{createdAt}</span>
                    </div>
                    {post.content && <HashtagText text={post.content} className="text-sm" />}
                    {post.imageUrl && (
                        <img
                            src={post.imageUrl}
                            alt="投稿画像"
                            className="mt-2 rounded-2xl border border-border max-h-[480px] object-cover"
                        />
                    )}
                    <div className="flex items-center gap-3 text-zinc-500 flex-wrap">
                        {session?.user ? (
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
                        ) : (
                            <div className="text-xs">いいね {likeCount}</div>
                        )}
                        {session?.user ? (
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
                        ) : (
                            <div className="text-xs">わかる {post.wakaruCount}</div>
                        )}
                        {session?.user ? (
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
                        ) : (
                            <div className="text-xs">頑張った！ {post.ganbattaCount}</div>
                        )}
                        {session?.user ? (
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
                        ) : (
                            <div className="text-xs">ブックマーク {post.bookmarks.length}</div>
                        )}
                        {session?.user && post.authorId === userId && (
                            <form action={deletePost.bind(null, post.id)}>
                                <button type="submit" className="text-xs text-red-500 hover:underline">
                                    削除
                                </button>
                            </form>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
