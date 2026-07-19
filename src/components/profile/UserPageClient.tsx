'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HashtagText from '@/components/shared/HashtagText';
import { formatPostTime } from '@/lib/formatTime';

type UserProfile = {
    id: string;
    name: string | null;
    email: string;
    bio: string | null;
    avatarUrl: string | null;
    headerUrl: string | null;
    posts: Array<{
        id: string;
        content: string;
        imageUrl: string | null;
        createdAt: string;
    }>;
};

export default function UserPageClient() {
    const searchParams = useSearchParams();
    const userId = searchParams.get('id') ?? '';
    const [result, setResult] = useState<{
        userId: string;
        profile: UserProfile | null;
        error: boolean;
    }>({ userId: '', profile: null, error: false });

    useEffect(() => {
        if (!userId) return;
        let active = true;
        fetch(`/api/user?id=${encodeURIComponent(userId)}`)
            .then((res) => (res.ok ? res.json() : Promise.reject(res)))
            .then((data) => {
                if (!active) return;
                setResult({ userId, profile: data?.user ?? null, error: !data?.user });
            })
            .catch(() => {
                if (!active) return;
                setResult({ userId, profile: null, error: true });
            });
        return () => {
            active = false;
        };
    }, [userId]);

    if (!userId) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーIDが未指定です。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    if (result.userId !== userId) {
        return <div className="p-6 text-sm text-zinc-500">読み込み中...</div>;
    }

    if (result.error || !result.profile) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーが見つかりませんでした。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const profile = result.profile;
    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">プロフィール</h1>
            </div>
            <div className="border-b border-border">
                <div className="h-32 bg-zinc-900">
                    {profile.headerUrl && (
                        <img src={profile.headerUrl} alt="ヘッダー画像" className="h-32 w-full object-cover" />
                    )}
                </div>
                <div className="p-4 flex items-start gap-4">
                    <div className="-mt-10">
                        {profile.avatarUrl ? (
                            <img
                                src={profile.avatarUrl}
                                alt="プロフィール画像"
                                className="w-20 h-20 rounded-full border-4 border-white object-cover"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-slate-400 border-4 border-white" />
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-lg font-bold">{profile.name ?? 'ユーザー'}</span>
                        <span className="text-sm text-zinc-500">@{profile.email.split('@')[0]}</span>
                        {profile.bio && <p className="text-sm text-zinc-500">{profile.bio}</p>}
                        <div className="flex gap-4 text-sm text-zinc-400 mt-2" />
                    </div>
                </div>
            </div>
            <div className="flex flex-col">
                {profile.posts.map((post) => (
                    <div key={post.id} className="p-4 border-b border-border flex gap-4">
                        {profile.avatarUrl ? (
                            <img
                                src={profile.avatarUrl}
                                alt="プロフィール画像"
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold">{profile.name ?? 'ユーザー'}</span>
                                <span className="text-zinc-500">@{profile.email.split('@')[0]}</span>
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
                        </div>
                    </div>
                ))}
                {profile.posts.length === 0 && (
                    <div className="p-6 text-sm text-zinc-500 text-center">まだ投稿がありません</div>
                )}
            </div>
        </div>
    );
}
