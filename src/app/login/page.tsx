'use client';

import { Suspense, useActionState } from 'react';
import { authenticate } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';

function SubmitButton({ staffMode }: { staffMode: boolean }) {
    const { pending } = useFormStatus();

    return (
        <Button
            type="submit"
            className="w-full rounded-full bg-white text-black hover:bg-zinc-200 font-bold"
            disabled={pending}
        >
            {pending
                ? 'ログイン中...'
                : staffMode
                  ? 'スタッフとしてログイン'
                  : 'ログイン'}
        </Button>
    );
}

function LoginContent() {
    const searchParams = useSearchParams();
    const [errorMessage, dispatch] = useActionState(authenticate, undefined);
    const accountDeleted = searchParams.get('account') === 'deleted';
    const staffMode = searchParams.get('mode') === 'staff';

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

                <div className="space-y-1 text-center">
                    <h1 className="text-3xl font-bold">
                        {staffMode ? 'スタッフログイン' : 'CoCoにログイン'}
                    </h1>
                    {staffMode && (
                        <p className="text-sm text-zinc-500">
                            管理・モデレーション用アカウント
                        </p>
                    )}
                </div>

                {accountDeleted && (
                    <p
                        role="status"
                        className="rounded-md bg-green-50 px-3 py-2 text-center text-sm text-green-700"
                    >
                        アカウントを削除しました。
                    </p>
                )}

                <form action={dispatch} className="space-y-4">
                    <div>
                        <label htmlFor="login-email" className="sr-only">
                            メールアドレス
                        </label>
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
                        <label htmlFor="login-password" className="sr-only">
                            パスワード
                        </label>
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

                    {staffMode && (
                        <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                            <div>
                                <label htmlFor="login-totp" className="sr-only">
                                    認証アプリの6桁コード
                                </label>
                                <input
                                    id="login-totp"
                                    name="totpCode"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    minLength={6}
                                    maxLength={6}
                                    autoComplete="one-time-code"
                                    aria-describedby="staff-auth-help"
                                    placeholder="認証アプリの6桁コード"
                                    className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="login-recovery" className="sr-only">
                                    リカバリーコード
                                </label>
                                <input
                                    id="login-recovery"
                                    name="recoveryCode"
                                    type="text"
                                    maxLength={64}
                                    autoComplete="off"
                                    aria-describedby="staff-auth-help"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    placeholder="リカバリーコード"
                                    className="w-full bg-white border border-zinc-300 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                                />
                            </div>

                            <p id="staff-auth-help" className="text-xs leading-5 text-zinc-500">
                                2段階認証を有効にしているスタッフは、6桁コードまたは未使用のリカバリーコードのどちらか一方を入力してください。
                            </p>
                        </div>
                    )}

                    {errorMessage && (
                        <p
                            className="text-red-600 text-sm text-center"
                            role="alert"
                            aria-live="polite"
                        >
                            {errorMessage}
                        </p>
                    )}

                    <SubmitButton staffMode={staffMode} />
                </form>

                <div className="space-y-3">
                    <p className="text-zinc-500 text-sm text-center">
                        <Link
                            href="/forgot-password"
                            className="text-[#1d9bf0] hover:underline"
                        >
                            パスワードを忘れた場合
                        </Link>
                    </p>

                    <p className="text-zinc-500 text-sm text-center">
                        <Link
                            href="/verify-email"
                            className="text-[#1d9bf0] hover:underline"
                        >
                            確認メールを再送する
                        </Link>
                    </p>

                    {!staffMode && (
                        <>
                            <p className="text-zinc-500 text-sm text-center">
                                <Link
                                    href="/appeal"
                                    className="text-[#1d9bf0] hover:underline"
                                >
                                    投稿制限・停止への異議申立て
                                </Link>
                            </p>
                            <p className="text-zinc-500 text-sm text-center">
                                アカウントがない場合は{' '}
                                <Link
                                    href="/register"
                                    className="text-[#1d9bf0] hover:underline"
                                >
                                    新規登録
                                </Link>
                            </p>
                        </>
                    )}
                </div>

                <div className="border-t border-zinc-200 pt-5 text-center">
                    {staffMode ? (
                        <Link
                            href="/login"
                            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
                        >
                            ← 通常ログインに戻る
                        </Link>
                    ) : (
                        <Link
                            href="/login?mode=staff"
                            className="text-sm text-zinc-500 hover:text-zinc-800 hover:underline"
                        >
                            スタッフの方はこちら
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
                    読み込み中...
                </div>
            }
        >
            <LoginContent />
        </Suspense>
    );
}
