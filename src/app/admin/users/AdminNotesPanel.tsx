"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAdminNote, type AdminNoteState } from "./actions";

type AdminNote = {
  id: string;
  body: string;
  createdAt: string;
  authorLabel: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
      disabled={pending}
    >
      {pending ? "追加中" : "メモを追加"}
    </button>
  );
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
};

export default function AdminNotesPanel({
  userId,
  notes,
}: {
  userId: string;
  notes: AdminNote[];
}) {
  const [state, dispatch] = useActionState<AdminNoteState, FormData>(createAdminNote, undefined);

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">管理者メモ</h2>
        <p className="mt-1 text-xs text-zinc-500">
          運営だけが見られる内部メモです。ユーザーには表示されません。
        </p>
      </div>

      <form action={dispatch} className="mb-4">
        <input type="hidden" name="userId" value={userId} />
        <textarea
          name="body"
          rows={4}
          maxLength={1000}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
          placeholder="対応方針、注意履歴、個別事情など"
          required
        />
        {state?.errors?.body && <p className="mt-1 text-xs text-red-600">{state.errors.body[0]}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {state?.message ? (
            <div className={state.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>
              {state.message}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">最大1000文字まで保存できます。</div>
          )}
          <SubmitButton />
        </div>
      </form>

      <div className="rounded-lg border border-border">
        {notes.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">管理者メモはまだありません。</div>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((note) => (
              <div key={note.id} className="p-4 text-sm">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                  <span>{formatDate(note.createdAt)}</span>
                  <span>{note.authorLabel}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-zinc-800">{note.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
