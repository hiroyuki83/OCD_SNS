'use client';

import {
  deletePost,
  togglePrivateAccount,
} from '@/app/lib/actions';

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
      <button type="submit" className="text-xs text-red-600 hover:underline">
        削除
      </button>
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
      <button
        type="submit"
        className={
          'text-xs hover:underline ' +
          (isPrivate ? 'text-red-600' : 'text-[#1d9bf0]')
        }
      >
        {isPrivate ? '鍵を外す' : '鍵をかける'}
      </button>
    </form>
  );
}
