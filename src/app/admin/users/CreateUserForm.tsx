'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createAdminUser, type CreateUserState } from './actions';

const roleOptions = [
  { value: 'USER', label: 'USER', helper: '通常ユーザーとして作成します。' },
  { value: 'MODERATOR', label: 'MODERATOR', helper: '通報対応とモデレーションを担当できます。' },
  { value: 'ADMIN', label: 'ADMIN', helper: 'ユーザー管理と管理機能全体を操作できます。' },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full bg-black px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
      disabled={pending}
    >
      {pending ? '作成中' : 'ユーザーを作成'}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

export default function CreateUserForm() {
  const [state, dispatch] = useActionState<CreateUserState, FormData>(createAdminUser, undefined);
  const errors = state?.errors;

  return (
    <form action={dispatch} className="rounded-lg border border-border p-4">
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          名前
          <input
            name="name"
            maxLength={50}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="表示名"
          />
          <FieldError messages={errors?.name} />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          メールアドレス
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="admin@example.com"
          />
          <FieldError messages={errors?.email} />
        </label>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          初期パスワード
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="8文字以上"
          />
          <FieldError messages={errors?.password} />
        </label>

        <label className="block text-sm font-medium text-zinc-700">
          初期パスワード確認
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={128}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="もう一度入力"
          />
          <FieldError messages={errors?.confirmPassword} />
        </label>
      </div>

      <fieldset className="mb-4">
        <legend className="text-sm font-medium text-zinc-700">権限</legend>
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {roleOptions.map((role) => (
            <label
              key={role.value}
              className="block cursor-pointer rounded-lg border border-border p-3 text-sm hover:bg-zinc-50"
            >
              <input
                name="role"
                type="radio"
                value={role.value}
                defaultChecked={role.value === 'USER'}
                className="mr-2"
              />
              <span className="font-semibold text-zinc-900">{role.label}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">{role.helper}</span>
            </label>
          ))}
        </div>
        <FieldError messages={errors?.role} />
      </fieldset>

      {state?.message && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          作成後、対象ユーザーの詳細画面へ移動します。初期パスワードは本人に安全な経路で共有してください。
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
