'use client';

import { useFormStatus } from 'react-dom';
import {
  overturnWarningAppeal,
  upholdWarningAppeal,
} from '@/app/moderation/appeals/actions';

function ReviewButtons({
  appealId,
  allowUphold,
}: {
  appealId: string;
  allowUphold: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {allowUphold && (
        <button
          type="submit"
          formAction={upholdWarningAppeal.bind(null, appealId)}
          disabled={pending}
          aria-disabled={pending}
          className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? '審査中…' : '警告を維持'}
        </button>
      )}
      <button
        type="submit"
        formAction={overturnWarningAppeal.bind(null, appealId)}
        disabled={pending}
        aria-disabled={pending}
        className="rounded-full border border-green-300 px-3 py-1 text-xs font-semibold text-green-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '審査中…' : '警告を取り消す'}
      </button>
    </div>
  );
}

export default function ModerationAppealReviewForm({
  appealId,
  allowUphold = true,
}: {
  appealId: string;
  allowUphold?: boolean;
}) {
  return (
    <form className="mt-3 rounded-md border border-border p-3">
      <label className="block text-xs font-semibold text-zinc-700">
        審査理由
        <textarea
          name="note"
          minLength={5}
          maxLength={500}
          required
          rows={3}
          className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
          placeholder="判断理由を入力してください"
        />
      </label>
      <ReviewButtons appealId={appealId} allowUphold={allowUphold} />
    </form>
  );
}
