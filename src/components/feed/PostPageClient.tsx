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
    author: { name: string | null; email: string; avatarUrl?: string | null };
};

export default function PostPageClient() {
    const searchParams = useSearchParams();
    const [postId, setPostId] = useState('');
    const [post, setPost] = useState<PostResponse | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

    useEffect(() => {
        const idFromParams = searchParams.get('id');
        if (idFromParams) {
            setPostId(idFromParams);
            return;
        }
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            const idFromWindow = url.searchParams.get('id');
            if (idFromWindow) setPostId(idFromWindow);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!postId) return;
        let active = true;
        setStatus('loading');
        fetch(`/api/post?id=${encodeURIComponent(postId)}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                if (!active) return;
                setPost(data?.post ?? null);
                setStatus(data?.post ? 'idle' : 'error');
            })
            .catch(() => {
                if (!active) return;
                setStatus('error');
            });
        return () => {
            active = false;
        };
    }, [postId]);

    if (status === 'loading') {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (!postId) {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (status === 'error' || !post) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                投稿が見つかりませんでした。
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const handle = post.author.email.split('@')[0];
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
                        <span className="font-bold">{post.author.name ?? 'ユーザー'}</span>
                        <span className="text-zinc-500">@{handle}</span>
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
