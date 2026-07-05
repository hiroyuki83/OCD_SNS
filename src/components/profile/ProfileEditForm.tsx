'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateProfile, type ProfileState } from '@/app/lib/actions';
import Cropper, { type Area } from 'react-easy-crop';

const AVATAR_ASPECT = 1;
const HEADER_ASPECT = 3;

async function getCroppedBlob(imageSrc: string, crop: Area) {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Canvas not supported');
    }
    ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
    );

    return new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob ?? new Blob());
        }, 'image/jpeg', 0.92);
    });
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="bg-[#1d9bf0] text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-[#1a8cd8] disabled:opacity-50"
            disabled={pending}
        >
            {pending ? '保存中...' : '保存する'}
        </button>
    );
}

export default function ProfileEditForm({
    name,
    bio,
    autoHashtag,
}: {
    name?: string | null;
    bio?: string | null;
    autoHashtag?: string | null;
}) {
    const [state, submitAction] = useActionState<ProfileState, FormData>(updateProfile, undefined);
    const [avatarName, setAvatarName] = useState('');
    const [headerName, setHeaderName] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [headerPreview, setHeaderPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [headerFile, setHeaderFile] = useState<File | null>(null);

    const [cropOpen, setCropOpen] = useState(false);
    const [cropTarget, setCropTarget] = useState<'avatar' | 'header'>('avatar');
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedArea, setCroppedArea] = useState<Area | null>(null);
    const [pendingFileName, setPendingFileName] = useState('');

    const aspect = cropTarget === 'avatar' ? AVATAR_ASPECT : HEADER_ASPECT;

    const handleAction = useMemo(
        () => async (formData: FormData) => {
            if (avatarFile) {
                formData.set('avatar', avatarFile);
            }
            if (headerFile) {
                formData.set('header', headerFile);
            }
            return submitAction(formData);
        },
        [avatarFile, headerFile, submitAction],
    );

    const openCropper = (file: File, target: 'avatar' | 'header') => {
        const reader = new FileReader();
        reader.onload = () => {
            setCropSrc(String(reader.result ?? ''));
            setCropTarget(target);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedArea(null);
            setPendingFileName(file.name);
            setCropOpen(true);
        };
        reader.readAsDataURL(file);
    };

    const applyCrop = async () => {
        if (!cropSrc || !croppedArea) return;
        const blob = await getCroppedBlob(cropSrc, croppedArea);
        const file = new File([blob], pendingFileName || 'crop.jpg', { type: 'image/jpeg' });
        const preview = URL.createObjectURL(file);
        if (cropTarget === 'avatar') {
            setAvatarFile(file);
            setAvatarPreview(preview);
            setAvatarName(file.name);
        } else {
            setHeaderFile(file);
            setHeaderPreview(preview);
            setHeaderName(file.name);
        }
        setCropOpen(false);
        setCropSrc(null);
    };

    return (
        <form action={handleAction} className="border border-border rounded-2xl p-4 space-y-4" encType="multipart/form-data">
            <div className="text-sm font-bold">プロフィールを編集</div>
            <label className="block text-xs text-zinc-500">
                名前
                <input
                    name="name"
                    defaultValue={name ?? ''}
                    className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-300 p-2 text-sm"
                />
            </label>
            <label className="block text-xs text-zinc-500">
                自己紹介
                <textarea
                    name="bio"
                    defaultValue={bio ?? ''}
                    rows={3}
                    className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-300 p-2 text-sm resize-none"
                />
            </label>
            <label className="block text-xs text-zinc-500">
                ハッシュタグ、自動追記
                <input
                    name="autoHashtag"
                    defaultValue={autoHashtag ?? ''}
                    className="mt-1 w-full rounded-lg bg-zinc-100 border border-zinc-300 p-2 text-sm"
                    placeholder="#タグ を入れてください"
                />
            </label>
            <div className="block text-xs text-zinc-500">
                アイコン画像
                <div className="mt-2 flex items-center gap-3">
                    {avatarPreview && (
                        <img
                            src={avatarPreview}
                            alt="アイコン画像のプレビュー"
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    )}
                    <label className="inline-flex items-center justify-center rounded-full bg-[#1d9bf0] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a8cd8] cursor-pointer">
                        画像を選択
                        <input
                            type="file"
                            name="avatar"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                    openCropper(file, 'avatar');
                                } else {
                                    setAvatarName('');
                                    setAvatarPreview(null);
                                    setAvatarFile(null);
                                }
                            }}
                        />
                    </label>
                    <span className="text-xs text-zinc-400">
                        {avatarName || '未選択'}
                    </span>
                </div>
            </div>
            <div className="block text-xs text-zinc-500">
                ヘッダー画像
                <div className="mt-2 flex items-center gap-3">
                    {headerPreview && (
                        <img
                            src={headerPreview}
                            alt="ヘッダー画像のプレビュー"
                            className="h-10 w-20 rounded-lg object-cover border border-border"
                        />
                    )}
                    <label className="inline-flex items-center justify-center rounded-full bg-[#1d9bf0] px-4 py-2 text-xs font-bold text-white hover:bg-[#1a8cd8] cursor-pointer">
                        画像を選択
                        <input
                            type="file"
                            name="header"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                    openCropper(file, 'header');
                                } else {
                                    setHeaderName('');
                                    setHeaderPreview(null);
                                    setHeaderFile(null);
                                }
                            }}
                        />
                    </label>
                    <span className="text-xs text-zinc-400">
                        {headerName || '未選択'}
                    </span>
                </div>
            </div>
            {state?.message && <div className="text-sm text-zinc-400">{state.message}</div>}
            <SubmitButton />

            {cropOpen && cropSrc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-bold">画像を調整</div>
                            <button
                                type="button"
                                className="text-xs text-zinc-500 hover:underline"
                                onClick={() => {
                                    setCropOpen(false);
                                    setCropSrc(null);
                                }}
                            >
                                閉じる
                            </button>
                        </div>
                        <div className="relative h-80 w-full bg-black/90 rounded-lg overflow-hidden">
                            <Cropper
                                image={cropSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={aspect}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_, area) => setCroppedArea(area)}
                            />
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.01}
                                value={zoom}
                                onChange={(event) => setZoom(Number(event.target.value))}
                                className="w-full"
                            />
                            <button
                                type="button"
                                onClick={applyCrop}
                                className="bg-[#1d9bf0] text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-[#1a8cd8]"
                            >
                                適用
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
}
