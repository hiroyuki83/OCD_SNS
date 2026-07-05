'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPost, type CreatePostState } from '@/app/lib/actions';

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [content, setContent] = useState('');
    const overLimit = content.length > 1000;
    const [clipboardMessage, setClipboardMessage] = useState<string | null>(null);

    useEffect(() => {
        if (state?.message === '投稿しました。') {
            formRef.current?.reset();
            setContent('');
            setClipboardMessage(null);
        }
    }, [state?.message]);

    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [autoFocus]);

    const handleClipboardImage = async (event?: React.ClipboardEvent<HTMLTextAreaElement>) => {
        setClipboardMessage(null);
        try {
            const items = event?.clipboardData?.items
                ? Array.from(event.clipboardData.items)
                : [];
            for (const item of items) {
                if (!item.type.startsWith('image/')) continue;
                const blob = item.getAsFile();
                if (!blob) continue;
                const file = new File([blob], `clipboard.${item.type.split('/')[1] ?? 'png'}`, {
                    type: item.type,
                });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                if (fileInputRef.current) {
                    fileInputRef.current.files = dataTransfer.files;
                    setClipboardMessage('クリップボードの画像を追加しました');
                    return;
                }
            }
            setClipboardMessage('クリップボードに画像がありません');
        } catch {
            setClipboardMessage('クリップボードの画像を取得できませんでした');
        }
    };

    return (
        <form
            ref={formRef}
            action={formAction}
            encType="multipart/form-data"
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
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onKeyDown={(event) => {
                        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                            event.preventDefault();
                            if (!overLimit) {
                                formRef.current?.requestSubmit();
                            }
                        }
                    }}
                    onPaste={(event) => {
                        const hasImage = Array.from(event.clipboardData?.items ?? []).some((item) =>
                            item.type.startsWith('image/'),
                        );
                        if (!hasImage) return;
                        event.preventDefault();
                        handleClipboardImage(event);
                    }}
                    placeholder="いまどうしてる？"
                    rows={3}
                    className="bg-transparent text-lg outline-none placeholder:text-zinc-500 resize-none"
                />
                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                    <label className="text-sm text-[#1d9bf0] cursor-pointer">
                        画像を追加
                        <input
                            type="file"
                            name="image"
                            accept="image/*"
                            className="hidden"
                            ref={fileInputRef}
                        />
                    </label>
                    <SubmitButton disabled={overLimit} />
                </div>
                {clipboardMessage && (
                    <p className="text-sm text-zinc-400">{clipboardMessage}</p>
                )}
                {overLimit && (
                    <p className="text-sm text-red-500">1000文字を超えています</p>
                )}
                {state?.message && (
                    <p className="text-sm text-zinc-400">{state.message}</p>
                )}
            </div>
        </form>
    );
}
