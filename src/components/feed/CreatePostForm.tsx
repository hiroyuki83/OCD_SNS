'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { createPost, type CreatePostState } from '@/app/lib/actions';
import { getPostSafetyNotice } from '@/lib/contentSafety';

function SubmitButton({ disabled }: { disabled?: boolean }) {
    const { pending } = useFormStatus();
    const isDisabled = pending || !!disabled;

    return (
        <button
            type="submit"
            className="bg-[#1d9bf0] text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-[#1a8cd8] disabled:opacity-50"
            disabled={isDisabled}
        >
            {pending ? '投稿中...' : '投稿'}
        </button>
    );
}

export default function CreatePostForm({
    autoFocus = false,
    avatarUrl = null,
}: {
    autoFocus?: boolean;
    avatarUrl?: string | null;
}) {
    const [state, formAction] = useActionState<CreatePostState, FormData>(createPost, undefined);
    const formRef = useRef<HTMLFormElement | null>(null);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const [content, setContent] = useState('');
    const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);
    const overLimit = content.length > 1000;
    const safetyNotice = getPostSafetyNotice(content);

    useEffect(() => {
        if (state?.message === '投稿しました。') {
            formRef.current?.reset();
            const frame = window.requestAnimationFrame(() => {
                setContent('');
                setSafetyAcknowledged(false);
            });
            return () => window.cancelAnimationFrame(frame);
        }
    }, [state?.message]);

    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [autoFocus]);

    return (
        <form
            ref={formRef}
            action={formAction}
            className="p-4 border-b border-border flex gap-4"
        >
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt="プロフィール画像"
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
            ) : (
                <div className="w-10 h-10 rounded-full bg-slate-400 flex-shrink-0" />
            )}
            <div className="flex-1 flex flex-col gap-2">
                <textarea
                    ref={inputRef}
                    name="content"
                    aria-label="投稿本文"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            if (!overLimit && content.trim()) {
                                formRef.current?.requestSubmit();
                            }
                        }
                    }}
                    placeholder="いまどうしてる？"
                    rows={3}
                    className="bg-transparent text-lg outline-none placeholder:text-zinc-500 resize-none"
                />
                <div className="flex items-center justify-between gap-3 mt-2">
                    <span className="text-xs text-zinc-400" aria-live="polite">
                        {content.length}/1000
                    </span>
                    <SubmitButton disabled={overLimit || !content.trim()} />
                </div>
                {overLimit && (
                    <p className="text-sm text-red-500">1000文字を超えています</p>
                )}
                {safetyNotice && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        {safetyNotice}{' '}
                        <Link href="/safety" className="font-semibold underline">
                            相談先を見る
                        </Link>
                    </div>
                )}
                {state?.safety?.requiresAcknowledgement && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900">
                        <p className="font-semibold">今すぐ危険がある場合は、投稿より先に支援につながってください。</p>
                        <p className="mt-1 leading-6">
                            地域の緊急窓口や身近な人に連絡できます。投稿は、この案内を確認した後も続けられます。
                        </p>
                        <Link href="/safety" className="mt-2 inline-block font-semibold underline">
                            相談先を確認する
                        </Link>
                        <label className="mt-3 flex items-start gap-2 font-medium">
                            <input
                                type="checkbox"
                                name="safetyAcknowledged"
                                value="true"
                                checked={safetyAcknowledged}
                                onChange={(event) => setSafetyAcknowledged(event.target.checked)}
                                className="mt-1"
                            />
                            案内を確認し、この内容で投稿を続けます
                        </label>
                    </div>
                )}
                {state?.message && (
                    <p className="text-sm text-zinc-500" aria-live="polite">{state.message}</p>
                )}
            </div>
        </form>
    );
}
