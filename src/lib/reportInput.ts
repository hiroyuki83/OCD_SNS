export type ReportDetailResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function normalizeReportDetail(
  rawValue: unknown,
  reason: string,
): ReportDetailResult {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (reason === 'OTHER') {
      return { ok: false, error: '「その他」を選んだ場合は詳細を10文字以上入力してください。' };
    }
    return { ok: true, value: null };
  }
  if (typeof rawValue !== 'string') {
    return { ok: false, error: '通報の詳細が不正です。' };
  }

  const normalized = rawValue
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();

  if (Array.from(normalized).length > 500) {
    return { ok: false, error: '通報の詳細は500文字以内です。' };
  }
  if (reason === 'OTHER' && Array.from(normalized).length < 10) {
    return { ok: false, error: '「その他」を選んだ場合は詳細を10文字以上入力してください。' };
  }

  return { ok: true, value: normalized || null };
}
