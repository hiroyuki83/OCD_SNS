'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'app-font-size';

const MIN_POINT = 10;
const MAX_POINT = 18;
const DEFAULT_POINT = 14;

const LABEL_TITLE = '文字サイズの設定';
const LABEL_DESC = '10pt〜18ptの範囲で変更できます。標準は14ptです。';
const LABEL_SIZE = '文字サイズ';

const options = Array.from({ length: MAX_POINT - MIN_POINT + 1 }, (_, index) => {
    const value = MIN_POINT + index;
    return { label: `${value}pt`, value };
});

function applyFontSize(value: number) {
    document.documentElement.style.setProperty('--app-font-size', `${value}pt`);
}

export default function FontSizeSetting() {
    const [size, setSize] = useState(DEFAULT_POINT);

    useEffect(() => {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const parsed = saved ? Number(saved) : NaN;
        const initial = Number.isFinite(parsed) ? parsed : DEFAULT_POINT;
        setSize(initial);
        applyFontSize(initial);
    }, []);

    const handleChange = (value: number) => {
        setSize(value);
        window.localStorage.setItem(STORAGE_KEY, String(value));
        applyFontSize(value);
    };

    return (
        <div className="border border-border rounded-2xl p-4 space-y-3">
            <div className="text-sm font-bold">{LABEL_TITLE}</div>
            <div className="text-xs text-zinc-500">{LABEL_DESC}</div>
            <div className="flex items-center gap-3">
                <label className="text-xs text-zinc-500">{LABEL_SIZE}</label>
                <select
                    value={size}
                    onChange={(event) => handleChange(Number(event.target.value))}
                    className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-bold text-zinc-700"
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
