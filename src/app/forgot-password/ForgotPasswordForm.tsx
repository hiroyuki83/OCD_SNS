'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { requestPasswordReset, type RequestPasswordResetState } from '@/app/password-reset/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-full rounded-full bg-black px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-400"
      disabled={pending}
    >
      {pending ? '送信中...' : '再設定メールを送信'}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, dispatch] = useActionState<RequestPasswordResetState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <div className="w-full max-w-sm p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-center">パスワード再設定</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          登録メールアドレスに再設定リンクを送ります。
        </p>
      </div>

      <form action={dispatch} className="space-y-4">
        <div>
          <input
            name="email"
            type="email"
            placeholder="メールアドレス"
            className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            required
          />
          {state?.errors?.email && <p className="mt-1 text-sm text-red-500">{state.errors.email[0]}</p>}
        </div>

        {state?.message && (
          <div
            className={
              'rounded-md px-3 py-2 text-sm ' +
              (state.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')
            }
          >
            {state.message}
          </div>
        )}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="text-[#1d9bf0] hover:underline">
          ログインに戻る
        </Link>
      </p>
    </div>
  );
}
