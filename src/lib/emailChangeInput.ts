import { z } from 'zod';

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'メールアドレスが長すぎます。')
  .email('正しいメールアドレスを入力してください。');

export type EmailChangeInput =
  | { ok: true; currentPassword: string; newEmail: string }
  | { ok: false; message: string };

export function parseEmailChangeInput(
  currentPasswordValue: FormDataEntryValue | null,
  newEmailValue: FormDataEntryValue | null,
): EmailChangeInput {
  if (typeof currentPasswordValue !== 'string' || currentPasswordValue.length < 1 || currentPasswordValue.length > 128) {
    return { ok: false, message: '現在のパスワードを入力してください。' };
  }
  if (typeof newEmailValue !== 'string') {
    return { ok: false, message: '新しいメールアドレスを入力してください。' };
  }

  const parsed = emailSchema.safeParse(newEmailValue);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'メールアドレスを確認してください。' };
  }

  return {
    ok: true,
    currentPassword: currentPasswordValue,
    newEmail: parsed.data,
  };
}
