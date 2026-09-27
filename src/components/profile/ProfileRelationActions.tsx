'use client';

import { useFormStatus } from 'react-dom';
import {
  acceptFollowRequest,
  rejectFollowRequest,
  removeFollower,
  unfollowUser,
  unblockUser,
  unmuteUser,
} from '@/app/lib/actions';

function PendingButton({
  idleLabel,
  pendingLabel,
  className,
}: {
  idleLabel: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function AcceptFollowForm({ followerId }: { followerId: string }) {
  return (
    <form action={acceptFollowRequest.bind(null, followerId)}>
      <PendingButton
        idleLabel="承認"
        pendingLabel="承認中…"
        className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white"
      />
    </form>
  );
}

export function RejectFollowForm({ followerId }: { followerId: string }) {
  return (
    <form action={rejectFollowRequest.bind(null, followerId)}>
      <PendingButton
        idleLabel="拒否"
        pendingLabel="処理中…"
        className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-zinc-700"
      />
    </form>
  );
}

export function RemoveFollowerForm({ followerId }: { followerId: string }) {
  return (
    <form
      action={removeFollower.bind(null, followerId)}
      onSubmit={(event) => {
        if (!window.confirm('このユーザーをフォロワーから削除しますか？')) {
          event.preventDefault();
        }
      }}
    >
      <PendingButton
        idleLabel="フォロワーから削除"
        pendingLabel="削除中…"
        className="text-xs font-semibold text-zinc-500 hover:text-red-500 hover:underline"
      />
    </form>
  );
}

export function UnfollowForm({
  targetUserId,
  pendingRequest,
}: {
  targetUserId: string;
  pendingRequest: boolean;
}) {
  return (
    <form action={unfollowUser.bind(null, targetUserId)}>
      <PendingButton
        idleLabel={pendingRequest ? '申請を取り消す' : 'フォロー解除'}
        pendingLabel="処理中…"
        className="text-xs font-semibold text-zinc-500 hover:text-red-500 hover:underline"
      />
    </form>
  );
}

export function UnblockForm({ targetUserId }: { targetUserId: string }) {
  return (
    <form action={unblockUser.bind(null, targetUserId)}>
      <PendingButton
        idleLabel="ブロック解除"
        pendingLabel="解除中…"
        className="text-xs text-[#1d9bf0] hover:underline"
      />
    </form>
  );
}

export function UnmuteForm({ targetUserId }: { targetUserId: string }) {
  return (
    <form action={unmuteUser.bind(null, targetUserId)}>
      <PendingButton
        idleLabel="ミュート解除"
        pendingLabel="解除中…"
        className="text-xs text-[#1d9bf0] hover:underline"
      />
    </form>
  );
}
