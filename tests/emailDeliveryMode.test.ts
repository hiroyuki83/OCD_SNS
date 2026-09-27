import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveE2eEmailOutboxPath } from '../src/lib/emailDeliveryMode';

test('enables local E2E outbox only when explicitly configured', () => {
  assert.equal(
    resolveE2eEmailOutboxPath({
      E2E_EMAIL_MODE: '1',
      E2E_EMAIL_OUTBOX_FILE: '/tmp/outbox.jsonl',
    }),
    '/tmp/outbox.jsonl',
  );
});

test('does not enable E2E outbox without the explicit mode flag', () => {
  assert.equal(
    resolveE2eEmailOutboxPath({
      E2E_EMAIL_OUTBOX_FILE: '/tmp/outbox.jsonl',
    }),
    null,
  );
});

test('never enables E2E outbox in Vercel production', () => {
  assert.equal(
    resolveE2eEmailOutboxPath({
      VERCEL_ENV: 'production',
      E2E_EMAIL_MODE: '1',
      E2E_EMAIL_OUTBOX_FILE: '/tmp/outbox.jsonl',
    }),
    null,
  );
});

test('rejects empty outbox paths', () => {
  assert.equal(
    resolveE2eEmailOutboxPath({
      E2E_EMAIL_MODE: '1',
      E2E_EMAIL_OUTBOX_FILE: '   ',
    }),
    null,
  );
});
