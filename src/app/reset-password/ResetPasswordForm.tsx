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

  if (state?.ok) {
    return (
      <div className="w-full max-w-sm p-8 space-y-6 text-center">
        <h1 className="text-3xl font-bold">パスワードを再設定しました</h1>
        <div
          role="status"
          aria-live="polite"
          className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700"
        >
          {state.message}
        </div>
        <Link href="/login" className="inline-block text-sm font-semibold text-[#1d9bf0] hover:underline">
          ログインへ進む
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-center">新しいパスワード</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          10文字以上の新しいパスワードを設定してください。
        </p>
      </div>

      <form action={dispatch} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div>
          <label htmlFor="reset-password" className="sr-only">新しいパスワード</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            placeholder="新しいパスワード"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            aria-invalid={Boolean(state?.errors?.password)}
            aria-describedby={state?.errors?.password ? 'reset-password-error' : undefined}
            className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            required
          />
          {state?.errors?.password && (
            <p id="reset-password-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.password.join(' ')}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="reset-password-confirm" className="sr-only">新しいパスワードの確認</label>
          <input
            id="reset-password-confirm"
            name="confirmPassword"
            type="password"
            placeholder="新しいパスワードをもう一度"
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            aria-invalid={Boolean(state?.errors?.confirmPassword)}
            aria-describedby={state?.errors?.confirmPassword ? 'reset-password-confirm-error' : undefined}
            className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            required
          />
          {state?.errors?.confirmPassword && (
            <p id="reset-password-confirm-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.confirmPassword.join(' ')}
            </p>
          )}
        </div>

        {state?.message && (
          <div
            role={state.ok ? 'status' : 'alert'}
            aria-live="polite"
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

    </div>
  );
}
