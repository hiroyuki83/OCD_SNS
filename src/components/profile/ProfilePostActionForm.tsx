'use client';

import { useRef, useState } from 'react';
import { Bookmark, CircleDot, Heart, Sparkles } from 'lucide-react';

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
  const [localActive, setLocalActive] = useState(active);
  const [localCount, setLocalCount] = useState(count);
  const [failed, setFailed] = useState(false);
  const localActiveRef = useRef(active);
  const localCountRef = useRef(count);
  const desiredActiveRef = useRef<boolean | null>(null);
  const inFlightRef = useRef(false);

  const config = configs[action];
  const Icon = config.Icon;

  const setOptimisticState = (nextActive: boolean, nextCount?: number) => {
    const previousActive = localActiveRef.current;
    localActiveRef.current = nextActive;
    setLocalActive(nextActive);

    if (typeof nextCount === 'number') {
      const normalized = Math.max(0, nextCount);
      localCountRef.current = normalized;
      setLocalCount(normalized);
      return;
    }

    if (action === 'bookmark') return;

    const current = localCountRef.current;
    if (typeof current !== 'number' || previousActive === nextActive) return;

    const updated = Math.max(0, current + (nextActive ? 1 : -1));
    localCountRef.current = updated;
    setLocalCount(updated);
  };

  const run = () => {
    const currentDesired =
      desiredActiveRef.current ?? localActiveRef.current;
    const nextDesired = !currentDesired;

    desiredActiveRef.current = nextDesired;
    setFailed(false);
    setOptimisticState(nextDesired);

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    void (async () => {
      try {
        while (desiredActiveRef.current !== null) {
          const targetActive = desiredActiveRef.current;

          const response = await fetch('/api/post-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId,
              action,
              active: targetActive,
            }),
          });

          if (!response.ok) throw new Error('failed');

          const payload = await response.json();
          if (typeof payload?.active !== 'boolean') {
            throw new Error('invalid response');
          }

          if (desiredActiveRef.current === targetActive) {
            desiredActiveRef.current = null;
            setOptimisticState(
              payload.active,
              typeof payload?.count === 'number'
                ? payload.count
                : undefined,
            );
            break;
          }
        }
      } catch {
        desiredActiveRef.current = null;
        localActiveRef.current = active;
        setLocalActive(active);
        localCountRef.current = count;
        setLocalCount(count);
        setFailed(true);
      } finally {
        inFlightRef.current = false;
      }
    })();
  };

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={run}
        aria-pressed={localActive}
        className={
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ' +
          (localActive ? config.activeClass : config.inactiveClass)
        }
      >
        <Icon
          className={'h-4 w-4 ' + config.iconClass}
          fill={
            localActive && (action === 'like' || action === 'bookmark')
              ? 'currentColor'
              : 'none'
          }
        />
        <span>{compactLabel ?? config.label}</span>
        {typeof localCount === 'number' ? (
          <span className="tabular-nums text-zinc-500">{localCount}</span>
        ) : null}
      </button>
      {failed ? (
        <span className="sr-only" role="status" aria-live="polite">
          更新できませんでした。元の状態に戻しました。
        </span>
      ) : null}
    </div>
  );
}
