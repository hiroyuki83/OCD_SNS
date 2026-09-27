export type AccountDeletionInput =
  | { ok: true; currentPassword: string }
  | { ok: false; message: string };

export function parseAccountDeletionInput(
  currentPasswordValue: FormDataEntryValue | null,
  confirmationValue: FormDataEntryValue | null,
): AccountDeletionInput {
  if (typeof currentPasswordValue !== 'string' || currentPasswordValue.length < 1 || currentPasswordValue.length > 128) {
    return { ok: false, message: '現在のパスワードを入力してください。' };
  }

  if (typeof confirmationValue !== 'string' || confirmationValue.trim() !== '削除する') {
    return { ok: false, message: '確認欄に「削除する」と入力してください。' };
  }

  return { ok: true, currentPassword: currentPasswordValue };
}
