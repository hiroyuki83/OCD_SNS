import { Suspense } from 'react';
import ExploreClient from '@/components/explore/ExploreClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ExplorePage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-zinc-500">読み込み中...</div>}>
            <ExploreClient />
        </Suspense>
    );
}
