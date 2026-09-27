import assert from 'node:assert/strict';
import test from 'node:test';
import { accountExportFilename, accountExportHeaders } from '../src/lib/accountExport';

test('uses a stable date-based account export filename', () => {
  assert.equal(
    accountExportFilename(new Date('2026-09-28T01:02:03.000Z')),
    'coco-account-export-2026-09-28.json',
  );
});

test('account exports are attachment downloads and never cacheable', () => {
  const headers = accountExportHeaders(new Date('2026-09-28T01:02:03.000Z'));
  assert.match(headers['content-disposition'], /^attachment;/);
  assert.match(headers['cache-control'], /no-store/);
  assert.equal(headers['x-content-type-options'], 'nosniff');
});
