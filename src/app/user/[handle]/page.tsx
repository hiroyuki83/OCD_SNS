import { Suspense } from 'react';
import UserHandleClient from '@/components/profile/UserHandleClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function UserHandlePage() {
    return (
        <Suspense fallback={<div className="p-6 text-sm text-zinc-500">読み込み中...</div>}>
            <UserHandleClient />
        </Suspense>
    );
}
