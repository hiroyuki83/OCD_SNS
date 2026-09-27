'use client';

import { useState } from 'react';
import { promptForReport, submitReport } from '@/lib/reportClient';

export default function ReportPostButton({ postId }: { postId: string }) {
  const [pending, setPending] = useState(false);

  const report = async () => {
    if (pending || !postId || postId.length > 128) return;
    const input = promptForReport();
    if (!input) return;

    setPending(true);
    try {
      const result = await submitReport({ postId }, input);
      window.alert(result.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={report}
      disabled={pending}
      aria-disabled={pending}
      className="rounded-full px-3 py-1 text-xs text-zinc-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? '送信中…' : '通報'}
    </button>
  );
}
