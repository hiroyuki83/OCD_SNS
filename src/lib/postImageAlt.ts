export type ImageAltResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

const MAX_IMAGE_ALT_CHARS = 300;

export function normalizeImageAlt(rawValue: FormDataEntryValue | string | null): ImageAltResult {
  if (typeof rawValue !== 'string') return { ok: true, value: null };

  const normalized = rawValue
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return { ok: true, value: null };
  if (Array.from(normalized).length > MAX_IMAGE_ALT_CHARS) {
    return { ok: false, error: '画像の説明は300文字以内です。' };
  }

  return { ok: true, value: normalized };
}
