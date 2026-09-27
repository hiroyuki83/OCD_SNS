'use client';

import { useActionState } from 'react';
import {
  requestEmailChange,
  type EmailChangeState,
} from '@/app/settings/account-actions';

export default function EmailChangeSetting({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState<EmailChangeState, FormData>(
    requestEmailChange,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="font-semibold">メールアドレス変更</h2>
      <p className="mt-1 text-sm text-zinc-500">
        現在: {currentEmail}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        新しいメールアドレスへ確認リンクを送ります。リンクを開くまで現在のアドレスは変更されません。
        確認後は安全のため、すべてのログイン状態を無効にします。
      </p>
      <form action={action} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-zinc-700">
          新しいメールアドレス
          <input
            name="newEmail"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-zinc-700">
          現在のパスワード
          <input
            name="currentPassword"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {pending ? '送信中…' : '変更確認メールを送信'}
        </button>
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
      </form>
    </section>
  );
}
