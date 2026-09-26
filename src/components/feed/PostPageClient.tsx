'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';

type PostResponse = {
    id: string;
    content: string;
    imageUrl: string | null;
    createdAt: string;
    author: { name: string | null; handle: string; avatarUrl?: string | null };
};

export default function PostPageClient() {
    const searchParams = useSearchParams();
    const rawPostId = (searchParams.get('id') ?? '').trim();
    const postId = rawPostId.length <= 128 ? rawPostId : '';
    const [result, setResult] = useState<{
        postId: string;
        post: PostResponse | null;
        error: boolean;
    }>({ postId: '', post: null, error: false });

    useEffect(() => {
        if (!postId) return;
        let active = true;
        const controller = new AbortController();
        fetch(`/api/post?id=${encodeURIComponent(postId)}`, {
            cache: 'no-store',
            credentials: 'include',
            signal: controller.signal,
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                if (!active) return;
                setResult({ postId, post: data?.post ?? null, error: !data?.post });
            })
            .catch(() => {
                if (!active) return;
                setResult({ postId, post: null, error: true });
            });
        return () => {
            active = false;
            controller.abort();
        };
    }, [postId]);

    if (!postId) {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (result.postId !== postId) {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (result.error || !result.post) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                投稿が見つかりませんでした。
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const post = result.post;
    const handle = post.author.handle;
    const createdAt = formatPostTime(post.createdAt);

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4 justify-between">
                <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">← 戻る</Link>
                <h1 className="font-bold text-base">投稿</h1>
                <div className="w-10" />
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
                </div>
            </div>
        </div>
    );
}
