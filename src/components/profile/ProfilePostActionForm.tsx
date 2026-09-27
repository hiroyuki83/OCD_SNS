'use client';

import { useFormStatus } from 'react-dom';
import {
  addGanbatta,
  addWakaru,
  toggleBookmark,
  toggleLike,
} from '@/app/lib/actions';

type PostActionKind = 'like' | 'wakaru' | 'ganbatta' | 'bookmark';

const configs: Record<
  PostActionKind,
  {
    label: string;
    activeClass: string;
    inactiveClass: string;
  }
> = {
  like: {
    label: 'いいね',
    activeClass: 'text-red-500',
    inactiveClass: 'hover:text-red-500',
  },
  wakaru: {
    label: 'わかる',
    activeClass: 'text-yellow-500',
    inactiveClass: 'hover:text-yellow-500',
  },
  ganbatta: {
    label: '頑張った！',
    activeClass: 'text-green-600',
    inactiveClass: 'hover:text-green-600',
  },
  bookmark: {
    label: 'ブックマーク',
    activeClass: 'text-blue-500',
    inactiveClass: 'hover:text-blue-500',
  },
};

function SubmitButton({
  action,
  active,
  count,
  compactLabel,
}: {
  action: PostActionKind;
  active: boolean;
  count?: number;
  compactLabel?: string;
}) {
  const { pending } = useFormStatus();
  const config = configs[action];
  return (
    <button
      type="submit"
      aria-pressed={active}
      disabled={pending}
      aria-disabled={pending}
      className={
        'rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        (active ? config.activeClass : config.inactiveClass)
      }
    >
      {pending ? '処理中…' : (compactLabel ?? config.label)}
      {typeof count === 'number' && !pending ? <span> {count}</span> : null}
    </button>
  );
}

export default function ProfilePostActionForm({
  postId,
  action,
  active,
  count,
  compactLabel,
}: {
  postId: string;
  action: PostActionKind;
  active: boolean;
  count?: number;
  compactLabel?: string;
}) {
  const serverAction =
    action === 'like'
      ? toggleLike
      : action === 'wakaru'
        ? addWakaru
        : action === 'ganbatta'
          ? addGanbatta
          : toggleBookmark;

  return (
    <form action={serverAction.bind(null, postId)}>
      <SubmitButton
        action={action}
        active={active}
        count={count}
        compactLabel={compactLabel}
      />
    </form>
  );
}
