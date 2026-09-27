export function parsePageNumber(rawValue: string | null | undefined) {
  if (!rawValue || !/^\d+$/.test(rawValue)) return 1;
  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export function clampPage(page: number, totalCount: number, pageSize: number) {
  const safePageSize =
    Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 1;
  const safeTotal =
    Number.isSafeInteger(totalCount) && totalCount > 0 ? totalCount : 0;
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage =
    Number.isSafeInteger(page) && page > 0 ? Math.min(page, totalPages) : 1;

  return {
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    skip: (safePage - 1) * safePageSize,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
