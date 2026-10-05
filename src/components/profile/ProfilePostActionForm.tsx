'use client';

import { useFormStatus } from 'react-dom';
import { Bookmark, CircleDot, Heart, Sparkles } from 'lucide-react';
import {
  addGanbatta,
  addWakaru,
  toggleBookmark,
  toggleLike,
} from '@/app/lib/actions';

type PostActionKind = 'like' | 'wakaru' | 'ganbatta' | 'bookmark';

const configs = {
  like: {
    label: 'いいね',
    Icon: Heart,
    iconClass: 'text-sky-500',
    activeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    inactiveClass: 'border-zinc-200 bg-white text-zinc-600 hover:bg-sky-50 hover:text-sky-700',
  },
  wakaru: {
    label: 'わかる',
    Icon: CircleDot,
    iconClass: 'text-teal-500',
    activeClass: 'border-teal-200 bg-teal-50 text-teal-700',
    inactiveClass: 'border-zinc-200 bg-white text-zinc-600 hover:bg-teal-50 hover:text-teal-700',
  },
  ganbatta: {
    label: '応援',
    Icon: Sparkles,
    iconClass: 'text-orange-500',
    activeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    inactiveClass: 'border-zinc-200 bg-white text-zinc-600 hover:bg-orange-50 hover:text-orange-700',
  },
  bookmark: {
    label: 'ブックマーク',
    Icon: Bookmark,
    iconClass: 'text-zinc-500',
    activeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    inactiveClass: 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800',
  },
} satisfies Record<
  PostActionKind,
  {
    label: string;
    Icon: typeof Heart;
    iconClass: string;
    activeClass: string;
    inactiveClass: string;
  }
>;

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
  const Icon = config.Icon;

  return (
    <button
      type="submit"
      aria-pressed={active}
      disabled={pending}
      aria-disabled={pending}
      className={
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
        (active ? config.activeClass : config.inactiveClass)
      }
    >
      <Icon
        className={'h-4 w-4 ' + config.iconClass}
        fill={
          active && (action === 'like' || action === 'bookmark')
            ? 'currentColor'
            : 'none'
        }
      />
      <span>{pending ? '処理中…' : (compactLabel ?? config.label)}</span>
      {typeof count === 'number' && !pending ? (
        <span className="tabular-nums text-zinc-500">{count}</span>
      ) : null}
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
