import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStaffRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from '../src/lib/recoveryCodes';

test('generates unique formatted staff recovery codes', () => {
  const codes = generateStaffRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    assert.match(code, /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
  }
});

test('normalization makes formatted and compact forms equivalent', () => {
  const formatted = 'ABCD-EFGH-JKLM-NPQR';
  const compact = 'abcdefghjklmnpqr';
  assert.equal(normalizeRecoveryCode(formatted), normalizeRecoveryCode(compact));
  assert.equal(hashRecoveryCode(formatted), hashRecoveryCode(compact));
});
