import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import UserHandleClient from '@/components/profile/UserHandleClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserHandlePage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    return (
        <Suspense fallback={<div className="p-6 text-sm text-zinc-500">読み込み中...</div>}>
            <UserHandleClient />
        </Suspense>
    );
}
