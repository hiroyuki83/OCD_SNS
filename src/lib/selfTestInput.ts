export function parseBoundedInteger(
  value: FormDataEntryValue | null,
  min: number,
  max: number,
) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function parseBoundedStringList(
  values: FormDataEntryValue[],
  maxItems: number,
  maxItemLength: number,
) {
  if (values.length > maxItems) return null;

  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') return null;
    const normalized = value
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim();
    if (!normalized || Array.from(normalized).length > maxItemLength) return null;
    result.push(normalized);
  }
  return result;
}

const ITQ_TIMINGS = new Set(['a', 'b', 'c', 'd', 'e', 'f']);

export function parseItqTiming(value: FormDataEntryValue | null) {
  return typeof value === 'string' && ITQ_TIMINGS.has(value) ? value : null;
}
