'use client';

import { useActionState } from 'react';
import {
  deleteOwnAccount,
  type AccountDeletionState,
} from '@/app/settings/account-actions';

export default function AccountDeletionSetting({ isStaff }: { isStaff: boolean }) {
  const [state, action, pending] = useActionState<AccountDeletionState, FormData>(
    deleteOwnAccount,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-red-200 p-4">
      <h2 className="font-semibold text-red-800">アカウント削除</h2>
      <p className="mt-1 text-sm text-zinc-600">
        プロフィール、投稿内容・画像、心理セルフチェック、フォロー関係などの本人データを削除します。
        通報・監査ログの整合性を保つため、匿名化された最小限のアカウント記録は残ります。
      </p>
      <p className="mt-2 text-xs text-red-700">
        この操作は取り消せません。削除後は現在のメールアドレスとパスワードではログインできません。
      </p>

      {isStaff ? (
        <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ADMIN / MODERATOR はここから削除できません。先に通常ユーザーへ権限変更してください。
        </div>
      ) : (
        <form
          action={action}
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            if (!window.confirm('アカウントを削除します。この操作は取り消せません。続けますか？')) {
              event.preventDefault();
            }
          }}
        >
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
          <label className="block text-sm font-medium text-zinc-700">
            確認のため「削除する」と入力
            <input
              name="confirmation"
              type="text"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-red-400 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            {pending ? '削除中…' : 'アカウントを削除'}
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
      )}
    </section>
  );
}
