'use client';

import { useActionState } from 'react';
import { register, type RegisterState } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" className="w-full rounded-full bg-white text-black hover:bg-zinc-200 font-bold" disabled={pending}>
            {pending ? '登録中...' : '新規登録'}
        </Button>
    );
}

export default function RegisterPage() {
    const [state, dispatch] = useActionState<RegisterState, FormData>(register, undefined);
    const fieldErrors = state && 'errors' in state ? state.errors : undefined;

    return (
        <div className="flex min-h-screen justify-center items-center bg-white text-black">
            <div className="w-full max-w-sm p-8 space-y-6">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 fill-white mx-auto r-4qtxqj r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-18jsvk2 r-16y2uox r-8kz0gk">
                    <g>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </g>
                </svg>
                <h1 className="text-3xl font-bold text-center">アカウントを作成</h1>
                <form action={dispatch} className="space-y-4">
                    <div>
                        <input
                            name="name"
                            placeholder="名前"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.name && <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>}
                    </div>
                    <div>
                        <input
                            name="email"
                            type="email"
                            placeholder="メールアドレス"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.email && <p className="text-red-500 text-sm mt-1">{fieldErrors.email}</p>}
                    </div>
                    <div>
                        <input
                            name="password"
                            type="password"
                            placeholder="パスワード"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.password && <p className="text-red-500 text-sm mt-1">{fieldErrors.password}</p>}
                    </div>
                    {state?.message && (
                        <p className={`text-sm text-center ${state.ok ? 'text-green-700' : 'text-red-500'}`}>
                            {state.message}
                        </p>
                    )}
                    {!state?.ok && <SubmitButton />}
                </form>
                {state?.ok && (
                    <p className="text-center text-sm">
                        <Link href="/verify-email" className="text-[#1d9bf0] hover:underline">
                            確認メールを再送する
                        </Link>
                    </p>
                )}
                <p className="text-zinc-500 text-sm text-center">
                    すでにアカウントがある場合は <Link href="/login" className="text-[#1d9bf0] hover:underline">ログイン</Link>
                </p>
            </div>
        </div>
    );
}
