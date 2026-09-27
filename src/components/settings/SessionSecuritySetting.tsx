'use client';

import { useActionState } from 'react';
import {
  revokeAllSessions,
  type SessionSecurityState,
} from '@/app/settings/security-actions';

export default function SessionSecuritySetting() {
  const [state, action, pending] = useActionState<SessionSecurityState, FormData>(
    revokeAllSessions,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="text-base font-semibold text-zinc-900">ログイン中の端末</h2>
      <p className="mt-1 text-xs text-zinc-500">
        不審なログインがある場合などに、現在の端末を含むすべてのログイン状態を無効にできます。
      </p>
      <form action={action} className="mt-3">
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
          className="mt-3 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
        >
          {pending ? '処理中…' : 'すべての端末からログアウト'}
        </button>
        {state?.message && (
          <div
            role={state.ok ? 'status' : 'alert'}
            aria-live="polite"
            className={
              'mt-3 rounded-md px-3 py-2 text-sm ' +
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
