import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOperationalErrorRecord } from '../src/lib/operationalError';

test('operational error records omit exception messages and stacks', () => {
  const error = new Error('email=user@example.com password=secret');
  const record = buildOperationalErrorRecord(
    'ACCOUNT_EXPORT_FAILED',
    error,
    new Date('2026-09-28T00:00:00.000Z'),
  );

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('user@example.com'), false);
  assert.equal(serialized.includes('secret'), false);
  assert.equal(serialized.includes('stack'), false);
  assert.equal(record.errorName, 'Error');
  assert.equal(record.event, 'ACCOUNT_EXPORT_FAILED');
});

test('operational error records contain an incident id and timestamp', () => {
  const record = buildOperationalErrorRecord(
    'TEST_EVENT',
    null,
    new Date('2026-09-28T00:00:00.000Z'),
  );
  assert.match(record.incidentId, /^[0-9a-f-]{36}$/i);
  assert.equal(record.occurredAt, '2026-09-28T00:00:00.000Z');
});
