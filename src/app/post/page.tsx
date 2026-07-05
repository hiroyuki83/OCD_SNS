import { Suspense } from 'react';
import PostPageClient from '@/components/feed/PostPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PostPage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-zinc-500">読み込み中...</div>}>
            <PostPageClient />
        </Suspense>
    );
}
