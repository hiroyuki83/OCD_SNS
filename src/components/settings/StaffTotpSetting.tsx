'use client';

import { useActionState } from 'react';
import {
  disableStaffTotp,
  enableStaffTotp,
  recoverStaffTotpWithRecoveryCode,
  regenerateStaffRecoveryCodes,
  startStaffTotpSetup,
  type TotpSetupState,
} from '@/app/settings/security-actions';

function Message({ state }: { state: TotpSetupState }) {
  if (!state?.message) return null;
  return (
    <div
      role={state.ok ? 'status' : 'alert'}
      aria-live="polite"
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
  unusedRecoveryCodeCount,
}: {
  enabled: boolean;
  unusedRecoveryCodeCount: number;
}) {
  const [setupState, setupAction, setupPending] = useActionState<TotpSetupState, FormData>(
    startStaffTotpSetup,
    undefined,
  );
  const [enableState, enableAction, enablePending] = useActionState<TotpSetupState, FormData>(
    enableStaffTotp,
    undefined,
  );
  const [recoveryState, recoveryAction, recoveryPending] = useActionState<TotpSetupState, FormData>(
    regenerateStaffRecoveryCodes,
    undefined,
  );
  const [recoveryResetState, recoveryResetAction, recoveryResetPending] = useActionState<TotpSetupState, FormData>(
    recoverStaffTotpWithRecoveryCode,
    undefined,
  );
  const [disableState, disableAction, disablePending] = useActionState<TotpSetupState, FormData>(
    disableStaffTotp,
    undefined,
  );
  const displayedRecoveryCodes =
    recoveryState?.recoveryCodes ?? enableState?.recoveryCodes;
  const enrollmentSecret = recoveryResetState?.secret ?? setupState?.secret;
  const enrollmentUri = recoveryResetState?.uri ?? setupState?.uri;

  return (
    <section className="mt-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">スタッフ2段階認証</h2>
          <p className="mt-1 text-xs text-zinc-500">
            ADMIN / MODERATOR 用の認証アプリによる6桁コードです。
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={
              'rounded-full px-3 py-1 text-xs font-semibold ' +
              (enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800')
            }
          >
            {enabled ? '有効' : '未設定'}
          </span>
          {enabled && (
            <span
              className={
                'text-xs font-semibold ' +
                (unusedRecoveryCodeCount <= 2 ? 'text-red-700' : 'text-zinc-500')
              }
            >
              未使用リカバリーコード: {unusedRecoveryCodeCount} / 10
            </span>
          )}
        </div>
      </div>

      {displayedRecoveryCodes && displayedRecoveryCodes.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            リカバリーコードを保存してください
          </div>
          <p className="mt-1 text-xs text-amber-800">
            この10個のコードは今回だけ表示されます。認証アプリを使えないときに、1コードにつき1回だけ使用できます。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {displayedRecoveryCodes.map((recoveryCode) => (
              <code
                key={recoveryCode}
                className="rounded border border-amber-200 bg-white px-3 py-2 text-center text-sm font-semibold tracking-wide"
              >
                {recoveryCode}
              </code>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-red-700">
            この画面を離れると平文のコードは再表示できません。パスワード管理アプリなど安全な場所に保存してください。
          </p>
        </div>
      )}

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
            <button
              disabled={setupPending}
              className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {setupPending ? '処理中…' : '2段階認証の登録を開始'}
            </button>
            <Message state={setupState} />
          </form>

          {enrollmentSecret && (
            <div className="mt-4 rounded-md border border-border p-3">
              <div className="text-sm font-semibold text-zinc-900">認証アプリへ登録</div>
              <p className="mt-1 text-xs text-zinc-500">
                Google Authenticator、Microsoft Authenticator、1Passwordなどで手動登録できます。
              </p>
              <div className="mt-3">
                <div className="text-xs font-semibold text-zinc-500">秘密鍵</div>
                <code className="mt-1 block break-all rounded bg-zinc-100 p-2 text-xs">
                  {enrollmentSecret}
                </code>
              </div>
              {enrollmentUri && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-600">
                    otpauth URIを表示
                  </summary>
                  <code className="mt-2 block break-all rounded bg-zinc-100 p-2 text-xs">
                    {enrollmentUri}
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
                  <button
                    disabled={enablePending}
                    className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {enablePending ? '確認中…' : 'コードを確認して有効化'}
                  </button>
                  <Message state={enableState} />
                </div>
              </form>
            </div>
          )}
        </>
      )}

      {enabled && (
        <>
          <form
            action={recoveryResetAction}
            onSubmit={(event) => {
              if (!window.confirm('認証アプリを再登録しますか？古い認証アプリと残りのリカバリーコードは無効になります。')) {
                event.preventDefault();
              }
            }}
            className="mt-4 rounded-md border border-amber-200 bg-amber-50/60 p-3"
          >
            <div className="text-sm font-semibold text-zinc-900">認証アプリを使えない場合</div>
            <p className="mt-1 text-xs text-zinc-600">
              現在のパスワードと未使用のリカバリーコードで、認証アプリを再登録できます。開始すると古い認証アプリと残りのリカバリーコードは無効になり、再有効化が終わるまで管理機能は使えません。再有効化完了時に全端末の既存セッションを無効にします。
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
                name="recoveryCode"
                type="text"
                required
                maxLength={64}
                autoComplete="off"
                placeholder="リカバリーコード"
                className="rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              disabled={recoveryResetPending}
              className="mt-3 rounded-full border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50"
            >
              {recoveryResetPending ? '処理中…' : '認証アプリを再登録'}
            </button>
            <Message state={recoveryResetState} />
          </form>

          <form
            action={recoveryAction}
            onSubmit={(event) => {
              if (!window.confirm('リカバリーコードを再発行しますか？現在の未使用コードはすべて無効になります。')) {
                event.preventDefault();
              }
            }}
            className="mt-4 rounded-md border border-border bg-zinc-50 p-3"
          >
            <div className="text-sm font-semibold text-zinc-900">リカバリーコードを再発行</div>
            <p className="mt-1 text-xs text-zinc-500">
              再発行すると、現在残っている古いリカバリーコードはすべて無効になります。
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
                placeholder="認証アプリの6桁コード"
                className="rounded-md border border-border bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              disabled={recoveryPending}
              className="mt-3 rounded-full border border-border px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
            >
              {recoveryPending ? '発行中…' : '新しい10個のコードを発行'}
            </button>
            <Message state={recoveryState} />
          </form>

          <form
            action={disableAction}
            onSubmit={(event) => {
              if (!window.confirm('2段階認証を解除しますか？リカバリーコードもすべて無効になります。')) {
                event.preventDefault();
              }
            }}
            className="mt-4 rounded-md border border-red-100 bg-red-50/50 p-3"
          >
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
          <button
            disabled={disablePending}
            className="mt-3 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            {disablePending ? '解除中…' : '2段階認証を解除'}
          </button>
          <Message state={disableState} />
        </form>
        </>
      )}
    </section>
  );
}
