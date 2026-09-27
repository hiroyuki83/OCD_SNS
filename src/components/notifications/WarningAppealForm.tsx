'use client';

import { useFormStatus } from 'react-dom';
import { submitWarningAppeal } from '@/app/notifications/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="rounded-full border border-amber-400 px-3 py-1 text-xs font-semibold text-amber-900 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? '送信中…' : '異議申立てを送信'}
    </button>
  );
}

export default function WarningAppealForm({ warningId }: { warningId: string }) {
  return (
    <form
      action={submitWarningAppeal}
      className="rounded-md border border-amber-200 bg-white/70 p-3"
    >
      <input type="hidden" name="warningId" value={warningId} />
      <label className="block text-xs font-semibold text-zinc-700">
        この警告に異議申立てをする
        <textarea
          name="message"
          minLength={10}
          maxLength={1000}
          required
          rows={3}
          placeholder="警告が適切でないと考える理由を入力してください"
          className="mt-2 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
      <div className="mt-2 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
