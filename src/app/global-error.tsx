'use client';

import { useEffect } from 'react';
import { logOperationalError } from '@/lib/operationalError';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logOperationalError('GLOBAL_APP_ERROR_BOUNDARY', error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
          <h1>CoCoを表示できませんでした</h1>
          <p>一時的なエラーの可能性があります。再読み込みをお試しください。</p>
          {error.digest && <p>エラー参照ID: {error.digest}</p>}
          <button type="button" onClick={reset}>
            もう一度試す
          </button>
        </main>
      </body>
    </html>
  );
}
