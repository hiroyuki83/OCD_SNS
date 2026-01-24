'use client';

import { useActionState } from 'react';
import { register } from '@/app/lib/actions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();

    return (
        <Button type="submit" className="w-full rounded-full bg-white text-black hover:bg-zinc-200 font-bold" disabled={pending}>
            {pending ? 'Account creation...' : 'Sign up'}
        </Button>
    );
}

export default function RegisterPage() {
    const [state, dispatch] = useActionState(register, undefined);

    return (
        <div className="flex min-h-screen justify-center items-center bg-black text-white">
            <div className="w-full max-w-sm p-8 space-y-6">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-10 w-10 fill-white mx-auto r-4qtxqj r-yyyyoo r-dnmrzs r-bnwqim r-1plcrui r-lrvibr r-18jsvk2 r-16y2uox r-8kz0gk">
                    <g>
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </g>
                </svg>
                <h1 className="text-3xl font-bold text-center">Create your account</h1>
                <form action={dispatch} className="space-y-4">
                    <div>
                        <input
                            name="name"
                            placeholder="Name"
                            className="w-full bg-black border border-zinc-700 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {state?.errors?.name && <p className="text-red-500 text-sm mt-1">{state.errors.name}</p>}
                    </div>
                    <div>
                        <input
                            name="email"
                            type="email"
                            placeholder="Email"
                            className="w-full bg-black border border-zinc-700 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {state?.errors?.email && <p className="text-red-500 text-sm mt-1">{state.errors.email}</p>}
                    </div>
                    <div>
                        <input
                            name="password"
                            type="password"
                            placeholder="Password"
                            className="w-full bg-black border border-zinc-700 rounded p-3 focus:border-[#1d9bf0] focus:outline-none"
                        />
                        {state?.errors?.password && <p className="text-red-500 text-sm mt-1">{state.errors.password}</p>}
                    </div>
                    {state?.message && <p className="text-red-500 text-sm text-center">{state.message}</p>}
                    <SubmitButton />
                </form>
                <p className="text-zinc-500 text-sm text-center">
                    Have an account already? <Link href="/login" className="text-[#1d9bf0] hover:underline">Log in</Link>
                </p>
            </div>
        </div>
    );
}
