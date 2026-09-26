'use client';

import { useActionState, useState } from 'react';
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
      {pending ? '送信中' : '招待を送信'}
    </button>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages[0]}</p>;
}

export default function CreateUserForm() {
  const [state, dispatch] = useActionState<CreateUserState, FormData>(createAdminUser, undefined);
  const [selectedRole, setSelectedRole] = useState<'USER' | 'MODERATOR' | 'ADMIN'>('USER');
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
                checked={selectedRole === role.value}
                onChange={() => setSelectedRole(role.value)}
                className="mr-2"
              />
              <span className="font-semibold text-zinc-900">{role.label}</span>
              <span className="mt-1 block text-xs leading-5 text-zinc-500">{role.helper}</span>
            </label>
          ))}
        </div>
        <FieldError messages={errors?.role} />
      </fieldset>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-700">
          操作確認用のADMINパスワード
          <input
            name="currentPassword"
            type="password"
            required
            maxLength={128}
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            placeholder="あなた自身のADMINパスワード"
          />
          <FieldError messages={errors?.currentPassword} />
        </label>

        {selectedRole === 'ADMIN' && (
          <label className="block text-sm font-medium text-zinc-700">
            ADMIN作成確認
            <input
              name="adminConfirmation"
              required
              maxLength={64}
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="CREATE ADMIN"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              ADMINを作成する場合は「CREATE ADMIN」と入力してください。
            </span>
            <FieldError messages={errors?.adminConfirmation} />
          </label>
        )}
      </div>

      {state?.message && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.message}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          本人の登録メールアドレスへ招待リンクを送ります。管理者が初期パスワードを知ることはありません。
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
