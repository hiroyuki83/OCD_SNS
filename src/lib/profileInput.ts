export type NormalizedHashtagResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

function normalizeLineEndings(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

function stripAsciiControls(value: string) {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

function clean(value: string) {
  return stripAsciiControls(normalizeLineEndings(value));
}

export function normalizeProfileName(value: string): string | null {
  const normalized = clean(value).replace(/\s+/g, ' ').trim();
  return normalized || null;
}

export function normalizeProfileBio(value: string): string | null {
  const normalized = clean(value)
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim();
  return normalized || null;
}

export function normalizeAutoHashtag(value: string): NormalizedHashtagResult {
  const normalized = clean(value).replace(/\s+/g, ' ').trim();
  if (!normalized) return { ok: true, value: null };
  if (normalized.length > 100) {
    return { ok: false, error: '自動ハッシュタグは100文字以内です。' };
  }

  const tags = normalized.split(' ');
  if (tags.length > 5) {
    return { ok: false, error: '自動ハッシュタグは5個まで入力できます。' };
  }

  for (const tag of tags) {
    if (!tag.startsWith('#') || tag === '#' || tag.slice(1).includes('#')) {
      return { ok: false, error: '自動ハッシュタグは「#タグ」の形式で入力してください。' };
    }
    if (Array.from(tag).length > 32) {
      return { ok: false, error: '1つの自動ハッシュタグは32文字以内です。' };
    }
  }

  return { ok: true, value: tags.join(' ') };
}
