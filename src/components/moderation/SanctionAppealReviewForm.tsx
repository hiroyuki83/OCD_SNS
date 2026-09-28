'use client';

import { useFormStatus } from 'react-dom';
import {
  overturnSanctionAppeal,
  upholdSanctionAppeal,
} from '@/app/moderation/appeals/sanctions/actions';

function ReviewButtons({ appealId }: { appealId: string }) {
  const { pending } = useFormStatus();

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="submit"
        formAction={upholdSanctionAppeal.bind(null, appealId)}
        disabled={pending}
        aria-disabled={pending}
        className="rounded-full border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '審査中…' : '処分を維持'}
      </button>
      <button
        type="submit"
        formAction={overturnSanctionAppeal.bind(null, appealId)}
        disabled={pending}
        aria-disabled={pending}
        className="rounded-full border border-green-300 px-3 py-1 text-xs font-semibold text-green-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? '審査中…' : '処分を取り消す'}
      </button>
    </div>
  );
}

export default function SanctionAppealReviewForm({
  appealId,
}: {
  appealId: string;
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
      <ReviewButtons appealId={appealId} />
    </form>
  );
}
