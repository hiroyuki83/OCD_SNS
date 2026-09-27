import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReportDetail } from '../src/lib/reportInput';

test('report detail normalizes line endings and control characters', () => {
  assert.deepEqual(normalizeReportDetail('  abc\r\ndef\u0000  ', 'SPAM'), {
    ok: true,
    value: 'abc\ndef',
  });
});

test('optional report detail can be blank for known reasons', () => {
  assert.deepEqual(normalizeReportDetail('', 'HARASSMENT'), {
    ok: true,
    value: null,
  });
});

test('OTHER requires a meaningful detail', () => {
  assert.equal(normalizeReportDetail('', 'OTHER').ok, false);
  assert.equal(normalizeReportDetail('short', 'OTHER').ok, false);
  assert.equal(normalizeReportDetail('0123456789', 'OTHER').ok, true);
});

test('report detail rejects more than 500 Unicode characters', () => {
  assert.equal(normalizeReportDetail('あ'.repeat(501), 'SPAM').ok, false);
});
