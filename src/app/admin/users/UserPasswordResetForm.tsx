"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetUserPassword, type ResetPasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:text-zinc-400"
      disabled={pending}
    >
      {pending ? "再設定中" : "パスワードを再設定"}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

export default function UserPasswordResetForm({ userId }: { userId: string }) {
  const [state, dispatch] = useActionState<ResetPasswordState, FormData>(resetUserPassword, undefined);

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">パスワード再発行</h2>
        <p className="mt-1 text-xs text-zinc-500">
          管理者が一時パスワードを設定します。変更内容は監査ログに記録されます。
        </p>
      </div>

      <form action={dispatch} className="grid gap-3 lg:grid-cols-12">
        <input type="hidden" name="userId" value={userId} />
        <label className="block text-sm font-medium text-zinc-700 lg:col-span-4">
          新しいパスワード
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={128}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="8文字以上"
            required
          />
          <FieldError messages={state?.errors?.password} />
        </label>
        <label className="block text-sm font-medium text-zinc-700 lg:col-span-4">
          確認
          <input
            name="confirmPassword"
            type="password"
            minLength={8}
            maxLength={128}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="もう一度入力"
            required
          />
          <FieldError messages={state?.errors?.confirmPassword} />
        </label>
        <div className="flex items-end lg:col-span-4">
          <SubmitButton />
        </div>
      </form>

      {state?.message && (
        <div
          className={
            "mt-3 rounded-md px-3 py-2 text-sm " +
            (state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")
          }
        >
          {state.message}
        </div>
      )}
    </section>
  );
}
