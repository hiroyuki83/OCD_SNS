export type SearchQueryResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

const MAX_SEARCH_QUERY_CHARS = 100;

export function normalizeSearchQuery(rawValue: string): SearchQueryResult {
  const normalized = rawValue
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return { ok: true, value: '' };
  if (Array.from(normalized).length > MAX_SEARCH_QUERY_CHARS) {
    return { ok: false, error: '検索語は100文字以内です。' };
  }

  return { ok: true, value: normalized };
}
