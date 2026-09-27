'use client';

import { useFormStatus } from 'react-dom';
import {
  deletePost,
  togglePrivateAccount,
} from '@/app/lib/actions';

function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? '削除中…' : '削除'}
    </button>
  );
}

function PrivacySubmitButton({ isPrivate }: { isPrivate: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        'text-xs hover:underline disabled:opacity-50 ' +
        (isPrivate ? 'text-red-600' : 'text-[#1d9bf0]')
      }
    >
      {pending ? '変更中…' : isPrivate ? '鍵を外す' : '鍵をかける'}
    </button>
  );
}

export function DeletePostForm({ postId }: { postId: string }) {
  return (
    <form
      action={deletePost.bind(null, postId)}
      onSubmit={(event) => {
        if (!window.confirm('この投稿を削除しますか？この操作は元に戻せません。')) {
          event.preventDefault();
        }
      }}
    >
      <DeleteSubmitButton />
    </form>
  );
}

export function PrivacyToggleForm({
  isPrivate,
  pendingRequestCount,
}: {
  isPrivate: boolean;
  pendingRequestCount: number;
}) {
  return (
    <form
      action={togglePrivateAccount}
      onSubmit={(event) => {
        const message = isPrivate
          ? pendingRequestCount > 0
            ? `公開アカウントに戻しますか？承認待ちの${pendingRequestCount}件は自動的に承認されます。`
            : '公開アカウントに戻しますか？'
          : '非公開アカウントに変更しますか？今後のフォローは承認制になります。';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <PrivacySubmitButton isPrivate={isPrivate} />
    </form>
  );
}
