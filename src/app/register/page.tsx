'use client';

import { useActionState } from 'react';
import { register, type RegisterState } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
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
                <Image
                    src="/icon/logo.png"
                    alt="CoCo"
                    width={64}
                    height={64}
                    className="mx-auto h-16 w-16 rounded-full object-cover"
                    priority
                />
                <h1 className="text-3xl font-bold text-center">アカウントを作成</h1>
                <form action={dispatch} className="space-y-4">
                    <div>
                        <label htmlFor="register-name" className="sr-only">名前</label>
                        <input
                            id="register-name"
                            name="name"
                            maxLength={50}
                            required
                            autoComplete="name"
                            aria-invalid={Boolean(fieldErrors?.name)}
                            aria-describedby={fieldErrors?.name ? 'register-name-error' : undefined}
                            placeholder="名前"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.name && <p id="register-name-error" className="text-red-600 text-sm mt-1" role="alert">{fieldErrors.name.join(' ')}</p>}
                    </div>
                    <div>
                        <label htmlFor="register-email" className="sr-only">メールアドレス</label>
                        <input
                            id="register-email"
                            name="email"
                            type="email"
                            maxLength={254}
                            required
                            autoComplete="email"
                            aria-invalid={Boolean(fieldErrors?.email)}
                            aria-describedby={fieldErrors?.email ? 'register-email-error' : undefined}
                            placeholder="メールアドレス"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.email && <p id="register-email-error" className="text-red-600 text-sm mt-1" role="alert">{fieldErrors.email.join(' ')}</p>}
                    </div>
                    <div>
                        <label htmlFor="register-password" className="sr-only">パスワード</label>
                        <input
                            id="register-password"
                            name="password"
                            type="password"
                            minLength={10}
                            maxLength={128}
                            required
                            autoComplete="new-password"
                            aria-invalid={Boolean(fieldErrors?.password)}
                            aria-describedby={fieldErrors?.password ? 'register-password-error' : undefined}
                            placeholder="パスワード"
                            className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {fieldErrors?.password && <p id="register-password-error" className="text-red-600 text-sm mt-1" role="alert">{fieldErrors.password.join(' ')}</p>}
                    </div>
                    {state?.message && (
                        <p
                            className={`text-sm text-center ${state.ok ? 'text-green-700' : 'text-red-600'}`}
                            role={state.ok ? 'status' : 'alert'}
                            aria-live="polite"
                        >
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
