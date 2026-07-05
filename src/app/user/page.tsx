import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserPage({
    searchParams,
}: {
    searchParams?: { id?: string };
}) {
    const userId = searchParams?.id?.trim();
    if (!userId) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーIDが未指定です。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });
    if (!user) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                ユーザーが見つかりませんでした。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">ホームに戻る</Link>
            </div>
        );
    }

    const handle = user.email.split('@')[0];
    redirect(`/user/${handle}`);
}
