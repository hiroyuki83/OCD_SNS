'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('AppErrorBoundary', {
      name: error.name,
      digest: error.digest ?? null,
    });
  }, [error]);

  return (
    <div className="p-6">
      <div className="rounded-lg border border-border p-5">
        <h1 className="text-lg font-semibold">ページを表示できませんでした</h1>
        <p className="mt-2 text-sm text-zinc-600">
          一時的なエラーの可能性があります。もう一度読み込んでください。
        </p>
        {error.digest && (
          <p className="mt-2 break-all text-xs text-zinc-500">
            エラー参照ID: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full border border-border px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1d9bf0]"
        >
          もう一度試す
        </button>
      </div>
    </div>
  );
}
