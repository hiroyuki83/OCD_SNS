"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetUserPassword, type ResetPasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-800 disabled:text-zinc-400"
      disabled={pending}
    >
      {pending ? "送信中" : "再設定メールを送る"}
    </button>
  );
}

export default function UserPasswordResetForm({ userId }: { userId: string }) {
  const [state, dispatch] = useActionState<ResetPasswordState, FormData>(resetUserPassword, undefined);

  return (
    <section className="mb-6 rounded-lg border border-border p-4">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900">パスワード再設定</h2>
        <p className="mt-1 text-xs text-zinc-500">
          管理者はパスワードを直接設定しません。本人の登録メールアドレスへ、1時間有効の再設定リンクを送信します。
        </p>
      </div>

      <form action={dispatch}>
        <input type="hidden" name="userId" value={userId} />
        <SubmitButton />
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
