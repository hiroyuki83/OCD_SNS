'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  submitSanctionAppeal,
  type SanctionAppealSubmitState,
} from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="w-full rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
    >
      {pending ? '確認中…' : '異議申立てを送信・状況確認'}
    </button>
  );
}

function sanctionLabel(type?: 'POST_RESTRICTION' | 'SUSPENSION') {
  return type === 'SUSPENSION' ? 'アカウント停止' : '投稿制限';
}

function statusLabel(status?: 'PENDING' | 'UPHELD' | 'OVERTURNED') {
  if (status === 'PENDING') return '審査中';
  if (status === 'UPHELD') return '処分維持';
  if (status === 'OVERTURNED') return '処分取消';
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return '期限なし';
  return new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

export default function SanctionAppealPage() {
  const [state, action] = useActionState<SanctionAppealSubmitState, FormData>(
    submitSanctionAppeal,
    undefined,
  );

  return (
    <div className="mx-auto w-full max-w-xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">処分への異議申立て</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          投稿制限またはアカウント停止について再審査を依頼できます。
          停止中でもこのページから申立てできますが、ここで通常のログインセッションは作成されません。
        </p>
      </div>

      {state?.ok && state.sanctionType ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-5 rounded-lg border border-border bg-zinc-50 p-4"
        >
          <div className="font-semibold text-zinc-900">{state.message}</div>
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-xs font-semibold text-zinc-500">対象</dt>
              <dd>{sanctionLabel(state.sanctionType)}</dd>
            </div>
            {state.status && (
              <div>
                <dt className="text-xs font-semibold text-zinc-500">状態</dt>
                <dd>{statusLabel(state.status)}</dd>
              </div>
            )}
            {state.sanctionReason && (
              <div>
                <dt className="text-xs font-semibold text-zinc-500">処分理由</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {state.sanctionReason}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-semibold text-zinc-500">処分期限</dt>
              <dd>{formatDate(state.endsAt)}</dd>
            </div>
            {state.resolutionNote && (
              <div>
                <dt className="text-xs font-semibold text-zinc-500">審査理由</dt>
                <dd className="whitespace-pre-wrap break-words">
                  {state.resolutionNote}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ) : state?.message ? (
        <p
          role="alert"
          aria-live="polite"
          className="mb-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {state.message}
        </p>
      ) : null}

      <form action={action} className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <label htmlFor="appeal-email" className="block text-sm font-medium text-zinc-700">
            登録メールアドレス
          </label>
          <input
            id="appeal-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
          {state?.errors?.email && (
            <p className="mt-1 text-xs text-red-700">{state.errors.email.join(' ')}</p>
          )}
        </div>

        <div>
          <label htmlFor="appeal-password" className="block text-sm font-medium text-zinc-700">
            パスワード
          </label>
          <input
            id="appeal-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            maxLength={128}
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm"
          />
          {state?.errors?.password && (
            <p className="mt-1 text-xs text-red-700">{state.errors.password.join(' ')}</p>
          )}
        </div>

        <div>
          <label htmlFor="appeal-message" className="block text-sm font-medium text-zinc-700">
            異議申立ての理由
          </label>
          <textarea
            id="appeal-message"
            name="message"
            maxLength={1000}
            rows={6}
            placeholder="処分が適切でないと考える理由や、再確認してほしい事情を入力してください"
            className="mt-2 w-full resize-y rounded-md border border-border px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">
            新規申立ては10文字以上。すでに申立て済みで状況確認だけする場合は空欄でも構いません。
          </p>
          {state?.errors?.message && (
            <p className="mt-1 text-xs text-red-700">{state.errors.message.join(' ')}</p>
          )}
        </div>

        <p className="text-xs leading-5 text-zinc-500">
          認証情報は本人確認のためだけに使用し、この操作ではログイン状態を作成しません。
          すでに申立て済みの場合は、同じフォームから現在の審査状況を確認できます。
        </p>

        <SubmitButton />
      </form>

      <div className="mt-5 text-sm text-zinc-500">
        <Link href="/login" className="hover:underline">
          ログイン画面へ戻る
        </Link>
      </div>
    </div>
  );
}
