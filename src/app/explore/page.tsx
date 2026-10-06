import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import ExploreClient from '@/components/explore/ExploreClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ExplorePage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    return (
        <Suspense fallback={<div className="p-6 text-sm text-zinc-500">読み込み中...</div>}>
            <ExploreClient />
        </Suspense>
    );
}
