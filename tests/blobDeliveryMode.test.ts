import assert from 'node:assert/strict';
import test from 'node:test';
import { isE2eBlobMode } from '../src/lib/blobDeliveryMode';

test('enables E2E blob mode only when explicitly requested', () => {
  assert.equal(isE2eBlobMode({ E2E_BLOB_MODE: '1', VERCEL_ENV: 'preview' }), true);
  assert.equal(isE2eBlobMode({ E2E_BLOB_MODE: '0', VERCEL_ENV: 'preview' }), false);
});

test('never enables E2E blob mode in production', () => {
  assert.equal(isE2eBlobMode({ E2E_BLOB_MODE: '1', VERCEL_ENV: 'production' }), false);
});
