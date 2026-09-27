'use client';

import { useActionState, useEffect, useState } from 'react';
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
    const [accountDeleted, setAccountDeleted] = useState(false);

    useEffect(() => {
        setAccountDeleted(new URLSearchParams(window.location.search).get('account') === 'deleted');
    }, []);

    return (
        <div className="flex min-h-screen justify-center items-center bg-white text-black">
            <div className="w-full max-w-sm p-8 space-y-6">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 fill-black mx-auto">
                    <g>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </g>
                </svg>
                <h1 className="text-3xl font-bold text-center">CoCoにログイン</h1>
                {accountDeleted && (
                    <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700">
                        アカウントを削除しました。
                    </p>
                )}
                <form action={dispatch} className="space-y-4">
                    <div>
                        <label htmlFor="login-email" className="sr-only">メールアドレス</label>
                        <input
                            id="login-email"
                            name="email"
                            type="email"
                            maxLength={254}
                            required
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="メールアドレス"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="login-password" className="sr-only">パスワード</label>
                        <input
                            id="login-password"
                            name="password"
                            type="password"
                            minLength={6}
                            maxLength={128}
                            required
                            placeholder="パスワード"
                            autoComplete="current-password"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="login-totp" className="sr-only">認証アプリの6桁コード</label>
                        <input
                            id="login-totp"
                            name="totpCode"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            minLength={6}
                            maxLength={6}
                            autoComplete="one-time-code"
                            aria-describedby="staff-auth-help"
                            placeholder="認証アプリの6桁コード（スタッフのみ）"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        <p id="staff-auth-help" className="mt-1 text-xs text-zinc-500">
                            2段階認証を有効にしているADMIN / MODERATORのみ入力してください。6桁コードとリカバリーコードは同時に入力せず、どちらか一方を使用します。
                        </p>
                    </div>
                    <div>
                        <label htmlFor="login-recovery" className="sr-only">リカバリーコード</label>
                        <input
                            id="login-recovery"
                            name="recoveryCode"
                            type="text"
                            maxLength={64}
                            autoComplete="off"
                            aria-describedby="staff-auth-help"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="リカバリーコード（認証アプリを使えない場合）"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-zinc-500">
                            スタッフは6桁コードの代わりに、未使用のリカバリーコードを1つ入力できます。
                        </p>
                    </div>
                    {errorMessage && (
                        <p
                            className="text-red-600 text-sm text-center"
                            role="alert"
                            aria-live="polite"
                        >
                            {errorMessage}
                        </p>
                    )}
                    <SubmitButton />
                </form>
                <p className="text-zinc-500 text-sm text-center">
                    <Link href="/forgot-password" className="text-[#1d9bf0] hover:underline">パスワードを忘れた場合</Link>
                </p>
                <p className="text-zinc-500 text-sm text-center">
                    <Link href="/verify-email" className="text-[#1d9bf0] hover:underline">確認メールを再送する</Link>
                </p>
                <p className="text-zinc-500 text-sm text-center">
                    アカウントがない場合は <Link href="/register" className="text-[#1d9bf0] hover:underline">新規登録</Link>
                </p>
            </div>
        </div>
    );
}
