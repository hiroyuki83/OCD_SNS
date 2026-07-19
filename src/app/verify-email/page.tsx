import Link from 'next/link';
import { ConfirmEmailForm, ResendEmailForm } from '@/app/verify-email/VerifyEmailForms';

export default async function VerifyEmailPage({
    searchParams,
}: {
    searchParams?: Promise<{ token?: string }>;
}) {
    const params = await searchParams;
    const token = params?.token?.trim() ?? '';

    return (
        <div className="flex min-h-screen items-center justify-center bg-white text-black">
            <div className="w-full max-w-sm space-y-6 p-8">
                <div>
                    <h1 className="text-center text-3xl font-bold">メールアドレスの確認</h1>
                    <p className="mt-2 text-center text-sm leading-6 text-zinc-500">
                        {token
                            ? '登録を完了するには、下のボタンを押してください。'
                            : '確認メールが届かない場合は再送できます。'}
                    </p>
                </div>
                {token ? <ConfirmEmailForm token={token} /> : <ResendEmailForm />}
                <p className="text-center text-sm text-zinc-500">
                    <Link href="/login" className="text-[#1d9bf0] hover:underline">
                        ログインに戻る
                    </Link>
                </p>
            </div>
        </div>
    );
}
