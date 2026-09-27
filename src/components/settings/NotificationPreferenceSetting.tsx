'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  updateNotificationPreferences,
  type NotificationPreferenceState,
} from '@/app/settings/notification-actions';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
    >
      {pending ? '保存中...' : '通知設定を保存'}
    </button>
  );
}

export default function NotificationPreferenceSetting({
  notifyLikes,
  notifyReactions,
  notifyFollows,
}: {
  notifyLikes: boolean;
  notifyReactions: boolean;
  notifyFollows: boolean;
}) {
  const [state, action] = useActionState<NotificationPreferenceState, FormData>(
    updateNotificationPreferences,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <h2 className="font-semibold">通知設定</h2>
      <p className="mt-1 text-sm text-zinc-500">
        通常のソーシャル通知を選べます。運営からの警告や重要なお知らせは対象外です。
      </p>

      <form action={action} className="mt-4 space-y-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="notifyLikes"
            defaultChecked={notifyLikes}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">いいね</span>
            <span className="block text-xs text-zinc-500">
              自分の投稿にいいねが付いたとき
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="notifyReactions"
            defaultChecked={notifyReactions}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">「わかる」「頑張った」</span>
            <span className="block text-xs text-zinc-500">
              自分の投稿にリアクションが付いたとき
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="notifyFollows"
            defaultChecked={notifyFollows}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">フォロー</span>
            <span className="block text-xs text-zinc-500">
              フォローまたはフォロー申請を受けたとき
            </span>
          </span>
        </label>

        {state?.message && (
          <p
            className={`text-sm ${state.ok ? 'text-green-700' : 'text-red-600'}`}
            role={state.ok ? 'status' : 'alert'}
            aria-live="polite"
          >
            {state.message}
          </p>
        )}

        <SaveButton />
      </form>
    </section>
  );
}
