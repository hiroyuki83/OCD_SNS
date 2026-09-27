export function accountExportFilename(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `coco-account-export-${date}.json`;
}

export function accountExportHeaders(now = new Date()) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': `attachment; filename="${accountExportFilename(now)}"`,
    'cache-control': 'private, no-store, max-age=0',
    pragma: 'no-cache',
    expires: '0',
    'x-content-type-options': 'nosniff',
  };
}
