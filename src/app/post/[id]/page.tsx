import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { formatPostTime } from '@/lib/formatTime';
import type { Prisma } from '@prisma/client';
import HashtagText from '@/components/shared/HashtagText';
import { accessiblePostWhere } from '@/lib/postAccess';
import ProfilePostActionForm from '@/components/profile/ProfilePostActionForm';
import { DeletePostForm } from '@/components/profile/ProfileDangerActions';
import ReportPostButton from '@/components/report/ReportPostButton';

export default async function PostPage({
    params,
}: {
    params: Promise<{ id?: string }>;
}) {
    const resolvedParams = await params;
    let postId = resolvedParams.id?.trim();
    if (!postId || postId.length > 128) {
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
            author: {
                select: {
                    id: true;
                    name: true;
                    handle: true;
                    avatarUrl: true;
                };
            };
            likes: {
                select: {
                    id: true;
                    userId: true;
                };
            };
            bookmarks: {
                select: {
                    id: true;
                    userId: true;
                };
            };
            reactions: {
                select: {
                    userId: true;
                    type: true;
                };
            };
            _count: {
                select: {
                    likes: true;
                    bookmarks: true;
                };
            };
        };
    }>;
    let post: PostWithRelations | null = null;
    let loadError: string | null = null;

    try {
        session = await auth();
        userId = session?.user?.id;
        if (!userId && session?.user?.email) {
            const viewer = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { id: true },
            });
            userId = viewer?.id;
        }
        post = await prisma.post.findFirst({
            where: accessiblePostWhere(userId ?? null, postId),
            include: {
                author: {
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                        avatarUrl: true,
                    },
                },
                likes: userId ? { where: { userId }, select: { id: true, userId: true } } : { take: 0 },
                bookmarks: userId ? { where: { userId }, select: { id: true, userId: true } } : { take: 0 },
                reactions: userId ? { where: { userId }, select: { userId: true, type: true } } : { take: 0 },
                _count: { select: { likes: true, bookmarks: true } },
            },
        });
    } catch (error) {
        console.error('Failed to load post detail:', error);
        loadError = 'failed';
    }

    if (loadError) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                読み込み中にエラーが発生しました。時間をおいて再度お試しください。
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
    const likeCount = post._count.likes;
    const bookmarked = !!userId && post.bookmarks.some((bookmark) => bookmark.userId === userId);
    const wakaruReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'WAKARU');
    const ganbattaReacted = !!userId && post.reactions.some((reaction) => reaction.userId === userId && reaction.type === 'GANBATTA');
    const createdAt = formatPostTime(post.createdAt);
    const handle = post.author.handle;

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
                        <Link href={`/user/${encodeURIComponent(handle)}`} className="font-bold hover:underline">
                            {post.author.name ?? 'ユーザー'}
                        </Link>
                        <Link href={`/user/${encodeURIComponent(handle)}`} className="text-zinc-500 hover:underline">
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
                        {userId ? (
                            <>
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
                                {post.authorId === userId ? (
                                    <DeletePostForm postId={post.id} />
                                ) : (
                                    <ReportPostButton postId={post.id} />
                                )}
                            </>
                        ) : (
                            <>
                                <div className="text-xs">いいね {likeCount}</div>
                                <div className="text-xs">わかる {post.wakaruCount}</div>
                                <div className="text-xs">頑張った！ {post.ganbattaCount}</div>
                                <div className="text-xs">ブックマーク {post._count.bookmarks}</div>
                            </>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}
