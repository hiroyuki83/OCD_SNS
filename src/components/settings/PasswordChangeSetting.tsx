'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  changePassword,
  type PasswordChangeState,
} from '@/app/settings/security-actions';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="rounded-full">
      {pending ? '変更中...' : 'パスワードを変更'}
    </Button>
  );
}

export default function PasswordChangeSetting() {
  const [state, action] = useActionState<PasswordChangeState, FormData>(
    changePassword,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="font-semibold">パスワード変更</h2>
      <p className="mt-1 text-sm text-zinc-500">
        変更後は安全のため、すべての端末の既存セッションを無効にしてログイン画面へ戻ります。
      </p>

      <form action={action} className="mt-4 space-y-3">
        <div>
          <label htmlFor="password-current" className="mb-1 block text-sm">
            現在のパスワード
          </label>
          <input
            id="password-current"
            name="currentPassword"
            type="password"
            required
            minLength={1}
            maxLength={128}
            autoComplete="current-password"
            className="w-full rounded border border-border bg-background p-2"
          />
        </div>

        <div>
          <label htmlFor="password-new" className="mb-1 block text-sm">
            新しいパスワード
          </label>
          <input
            id="password-new"
            name="newPassword"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            className="w-full rounded border border-border bg-background p-2"
            aria-describedby="password-new-help"
          />
          <p id="password-new-help" className="mt-1 text-xs text-zinc-500">
            10〜128文字で設定してください。
          </p>
        </div>

        <div>
          <label htmlFor="password-confirm" className="mb-1 block text-sm">
            新しいパスワード（確認）
          </label>
          <input
            id="password-confirm"
            name="confirmPassword"
            type="password"
            required
            minLength={10}
            maxLength={128}
            autoComplete="new-password"
            className="w-full rounded border border-border bg-background p-2"
          />
        </div>

        {state?.message && (
          <p
            className={`text-sm ${state.ok ? 'text-green-700' : 'text-red-600'}`}
            role={state.ok ? 'status' : 'alert'}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}

        <SubmitButton />
      </form>
    </section>
  );
}
