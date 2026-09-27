import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('main and integration branch do not auto-deploy before release gates complete', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const enabled = config.git?.deploymentEnabled ?? {};

  assert.equal(
    enabled.main,
    false,
    'main must not auto-deploy to Production; Production release is explicit',
  );
  assert.equal(
    enabled['security-integration-final-20260926'],
    false,
    'integration Preview auto-deploy stays disabled until Preview DB migration is complete',
  );
});
