'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    requestEmailVerification,
    verifyEmail,
    type VerifyEmailState,
} from '@/app/verify-email/actions';

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-black px-4 py-3 text-sm font-bold text-white disabled:bg-zinc-400"
        >
            {pending ? pendingLabel : label}
        </button>
    );
}

function StateMessage({ state }: { state: VerifyEmailState }) {
    if (!state?.message) return null;
    return (
        <div className={`rounded-md px-3 py-2 text-sm ${state.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {state.message}
        </div>
    );
}

export function ConfirmEmailForm({ token }: { token: string }) {
    const [state, action] = useActionState<VerifyEmailState, FormData>(verifyEmail, undefined);
    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <StateMessage state={state} />
            {!state?.ok && <SubmitButton label="メールアドレスを確認" pendingLabel="確認中..." />}
            {state?.ok && (
                <Link href="/login" className="block text-center text-sm font-semibold text-[#1d9bf0] hover:underline">
                    ログインへ進む
                </Link>
            )}
        </form>
    );
}

export function ResendEmailForm() {
    const [state, action] = useActionState<VerifyEmailState, FormData>(requestEmailVerification, undefined);
    return (
        <form action={action} className="space-y-4">
            <input
                type="email"
                name="email"
                required
                placeholder="登録メールアドレス"
                className="w-full rounded-md border border-zinc-300 bg-white p-3 focus:border-[#1d9bf0] focus:outline-none"
            />
            {state?.errors?.email && <p className="text-sm text-red-500">{state.errors.email[0]}</p>}
            <StateMessage state={state} />
            <SubmitButton label="確認メールを再送" pendingLabel="送信中..." />
        </form>
    );
}
