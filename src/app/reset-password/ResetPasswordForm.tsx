'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { resetPassword, type ResetPasswordState } from '@/app/password-reset/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-full rounded-full bg-black px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-400"
      disabled={pending}
    >
      {pending ? '再設定中...' : 'パスワードを再設定'}
    </button>
  );
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, dispatch] = useActionState<ResetPasswordState, FormData>(resetPassword, undefined);

  return (
    <div className="w-full max-w-sm p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-center">新しいパスワード</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          8文字以上の新しいパスワードを設定してください。
        </p>
      </div>

      <form action={dispatch} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <input
            name="password"
            type="password"
            placeholder="新しいパスワード"
            minLength={8}
            maxLength={128}
            className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            required
          />
          {state?.errors?.password && <p className="mt-1 text-sm text-red-500">{state.errors.password[0]}</p>}
        </div>
        <div>
          <input
            name="confirmPassword"
            type="password"
            placeholder="新しいパスワードをもう一度"
            minLength={8}
            maxLength={128}
            className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            required
          />
          {state?.errors?.confirmPassword && (
            <p className="mt-1 text-sm text-red-500">{state.errors.confirmPassword[0]}</p>
          )}
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

      {state?.ok && (
        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="text-[#1d9bf0] hover:underline">
            ログインへ進む
          </Link>
        </p>
      )}
    </div>
  );
}
