'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  submitWarningAppeal,
  type WarningAppealSubmitState,
} from '@/app/notifications/actions';

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
  const [state, action] = useActionState<WarningAppealSubmitState, FormData>(
    submitWarningAppeal,
    undefined,
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-green-200 bg-green-50 p-3 text-xs font-semibold text-green-800"
      >
        {state.message}
      </div>
    );
  }

  return (
    <form
      action={action}
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
          aria-invalid={Boolean(state?.errors?.message)}
          aria-describedby={state?.errors?.message ? `warning-appeal-error-${warningId}` : undefined}
          className="mt-2 w-full resize-y rounded-md border border-border bg-white px-3 py-2 text-sm"
        />
      </label>
      {state?.errors?.message && (
        <p
          id={`warning-appeal-error-${warningId}`}
          role="alert"
          className="mt-2 text-xs text-red-700"
        >
          {state.errors.message.join(' ')}
        </p>
      )}
      {state?.message && !state.ok && (
        <p role="alert" aria-live="polite" className="mt-2 text-xs text-red-700">
          {state.message}
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
