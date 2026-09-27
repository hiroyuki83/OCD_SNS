import { REPORT_REASONS, type ReportReasonValue } from '@/lib/reportReasons';

export type ReportTarget =
  | { postId: string }
  | { targetUserId: string };

export type ReportPromptResult = {
  reason: ReportReasonValue;
  detail: string;
};

export function promptForReport(): ReportPromptResult | null {
  const reasonGuide = REPORT_REASONS
    .map((reason, index) => `${index + 1}. ${reason.label}`)
    .join('\n');
  const selected = window.prompt(`通報理由を番号で選んでください。\n${reasonGuide}`);
  if (selected === null) return null;

  const normalizedSelection = selected.trim();
  if (!/^\d+$/.test(normalizedSelection)) {
    window.alert('通報理由の番号が正しくありません。');
    return null;
  }

  const selectedReason = REPORT_REASONS[Number(normalizedSelection) - 1];
  if (!selectedReason) {
    window.alert('通報理由の番号が正しくありません。');
    return null;
  }

  const reason = selectedReason.value;
  const detail = window.prompt(
    reason === 'OTHER'
      ? '「その他」の場合は、通報理由を10〜500文字で入力してください。'
      : '必要であれば詳細を入力してください（500文字以内・空欄可）。',
  );
  if (detail === null) return null;

  const normalizedDetail = detail.trim();
  const detailLength = Array.from(normalizedDetail).length;
  if (detailLength > 500) {
    window.alert('通報理由は500文字以内で入力してください。');
    return null;
  }
  if (reason === 'OTHER' && detailLength < 10) {
    window.alert('「その他」の場合は、通報理由を10文字以上入力してください。');
    return null;
  }

  return { reason, detail: normalizedDetail };
}

export async function submitReport(
  target: ReportTarget,
  report: ReportPromptResult,
): Promise<{ ok: boolean; message: string }> {
  const targetId = 'postId' in target ? target.postId : target.targetUserId;
  if (!targetId || targetId.length > 128) {
    return { ok: false, message: '通報対象が正しくありません。' };
  }

  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify({ ...target, ...report }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        ok: false,
        message:
          typeof payload?.error === 'string'
            ? payload.error
            : '通報に失敗しました。',
      };
    }

    return {
      ok: true,
      message:
        payload?.duplicate === true
          ? 'この対象への未解決の通報は既に送信済みです。'
          : '通報を受け付けました。',
    };
  } catch {
    return {
      ok: false,
      message: '通信エラーのため通報を送信できませんでした。',
    };
  }
}
