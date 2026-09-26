'use client';

import { useActionState } from 'react';
import {
  disableStaffTotp,
  enableStaffTotp,
  startStaffTotpSetup,
  type TotpSetupState,
} from '@/app/settings/security-actions';

function Message({ state }: { state: TotpSetupState }) {
  if (!state?.message) return null;
  return (
    <div
      className={
        'mt-3 rounded-md px-3 py-2 text-sm ' +
        (state.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')
      }
    >
      {state.message}
    </div>
  );
}

export default function StaffTotpSetting({
  enabled,
}: {
  enabled: boolean;
}) {
  const [setupState, setupAction] = useActionState<TotpSetupState, FormData>(
    startStaffTotpSetup,
    undefined,
  );
  const [enableState, enableAction] = useActionState<TotpSetupState, FormData>(
    enableStaffTotp,
    undefined,
  );
  const [disableState, disableAction] = useActionState<TotpSetupState, FormData>(
    disableStaffTotp,
    undefined,
  );

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">スタッフ2段階認証</h2>
          <p className="mt-1 text-xs text-zinc-500">
            ADMIN / MODERATOR 用の認証アプリによる6桁コードです。
          </p>
        </div>
        <span
          className={
            'rounded-full px-3 py-1 text-xs font-semibold ' +
            (enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800')
          }
        >
          {enabled ? '有効' : '未設定'}
        </span>
      </div>

      {!enabled && (
        <>
          <form action={setupAction} className="mt-4 rounded-md bg-zinc-50 p-3">
            <label className="block text-sm font-medium text-zinc-700">
              現在のパスワード
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </label>
            <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              2段階認証の登録を開始
            </button>
            <Message state={setupState} />
          </form>

          {setupState?.secret && (
            <div className="mt-4 rounded-md border border-border p-3">
              <div className="text-sm font-semibold text-zinc-900">認証アプリへ登録</div>
              <p className="mt-1 text-xs text-zinc-500">
                Google Authenticator、Microsoft Authenticator、1Passwordなどで手動登録できます。
              </p>
              <div className="mt-3">
                <div className="text-xs font-semibold text-zinc-500">秘密鍵</div>
                <code className="mt-1 block break-all rounded bg-zinc-100 p-2 text-xs">
                  {setupState.secret}
                </code>
              </div>
              {setupState.uri && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600">
                    otpauth URIを表示
                  </summary>
                  <code className="mt-2 block break-all rounded bg-zinc-100 p-2 text-xs">
                    {setupState.uri}
                  </code>
                </details>
              )}

              <form action={enableAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-zinc-700">
                  現在のパスワード
                  <input
                    name="currentPassword"
                    type="password"
                    required
                    maxLength={128}
                    autoComplete="current-password"
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-zinc-700">
                  6桁コード
                  <input
                    name="code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
                    placeholder="123456"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
                    コードを確認して有効化
                  </button>
                  <Message state={enableState} />
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {enabled && (
        <form action={disableAction} className="mt-4 rounded-md border border-red-100 bg-red-50/50 p-3">
          <div className="text-sm font-semibold text-zinc-900">2段階認証を解除</div>
          <p className="mt-1 text-xs text-zinc-500">
            解除には現在のパスワードと認証アプリの新しい6桁コードが必要です。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              name="currentPassword"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              placeholder="現在のパスワード"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoComplete="one-time-code"
              placeholder="6桁コード"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm"
            />
          </div>
          <button className="mt-3 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700">
            2段階認証を解除
          </button>
          <Message state={disableState} />
        </form>
      )}
    </section>
  );
}
