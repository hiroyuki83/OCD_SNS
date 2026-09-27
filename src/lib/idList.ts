export type StringIdListResult =
  | { ok: true; value: string[] }
  | { ok: false };

export function parseUniqueStringIds(
  value: unknown,
  maxItems: number,
  maxLength = 128,
): StringIdListResult {
  if (!Array.isArray(value)) return { ok: false };
  if (
    !Number.isSafeInteger(maxItems) ||
    maxItems < 0 ||
    value.length > maxItems ||
    !Number.isSafeInteger(maxLength) ||
    maxLength < 1
  ) {
    return { ok: false };
  }

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false };
    const id = item.trim();
    if (!id || id.length > maxLength || seen.has(id)) return { ok: false };
    seen.add(id);
    ids.push(id);
  }

  return { ok: true, value: ids };
}
