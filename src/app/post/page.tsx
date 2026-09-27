import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function PostPage({
    searchParams,
}: {
    searchParams?: { id?: string };
}) {
    const postId = searchParams?.id?.trim();
    if (!postId || postId.length > 128) {
        return (
            <div className="p-6 text-sm text-zinc-500">
                投稿IDが指定されていません。{' '}
                <Link href="/" className="text-[#1d9bf0] hover:underline">
                    ホームに戻る
                </Link>
            </div>
        );
    }

    redirect(`/post/${encodeURIComponent(postId)}`);
}
