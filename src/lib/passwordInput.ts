export type PasswordChangeInput =
  | {
      ok: true;
      currentPassword: string;
      newPassword: string;
    }
  | {
      ok: false;
      message: string;
    };

function readPassword(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value : '';
}

export function parsePasswordChangeInput(
  currentValue: FormDataEntryValue | null,
  newValue: FormDataEntryValue | null,
  confirmValue: FormDataEntryValue | null,
): PasswordChangeInput {
  const currentPassword = readPassword(currentValue);
  const newPassword = readPassword(newValue);
  const confirmPassword = readPassword(confirmValue);

  if (currentPassword.length < 1 || currentPassword.length > 128) {
    return { ok: false, message: '現在のパスワードを入力してください。' };
  }
  if (newPassword.length < 10) {
    return { ok: false, message: '新しいパスワードは10文字以上にしてください。' };
  }
  if (newPassword.length > 128) {
    return { ok: false, message: '新しいパスワードは128文字以内にしてください。' };
  }
  if (!/\S/.test(newPassword)) {
    return { ok: false, message: '新しいパスワードに空白以外の文字を含めてください。' };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, message: '新しいパスワードの確認入力が一致しません。' };
  }
  if (currentPassword === newPassword) {
    return { ok: false, message: '現在とは異なるパスワードを設定してください。' };
  }

  return { ok: true, currentPassword, newPassword };
}
