'use client';

import { useActionState } from 'react';
import { authenticate } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" className="w-full rounded-full bg-white text-black hover:bg-zinc-200 font-bold" disabled={pending}>
            {pending ? 'ログイン中...' : 'ログイン'}
        </Button>
    );
}

export default function LoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined);

    return (
        <div className="flex min-h-screen justify-center items-center bg-white text-black">
            <div className="w-full max-w-sm p-8 space-y-6">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 fill-white mx-auto r-4qtxqj r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-18jsvk2 r-16y2uox r-8kz0gk">
                    <g>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </g>
                </svg>
                <h1 className="text-3xl font-bold text-center">Xにログイン</h1>
                <form action={dispatch} className="space-y-4">
                    <div>
                        <input
                            name="email"
                            type="email"
                            placeholder="メールアドレス"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                    </div>
                    <div>
                        <input
                            name="password"
                            type="password"
                            placeholder="パスワード"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                    </div>
                    {errorMessage && (
                        <p className="text-red-500 text-sm text-center">{errorMessage}</p>
                    )}
                    <SubmitButton />
                </form>
                <p className="text-zinc-500 text-sm text-center">
                    アカウントがない場合は <Link href="/register" className="text-[#1d9bf0] hover:underline">新規登録</Link>
                </p>
            </div>
        </div>
    );
}
