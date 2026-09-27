import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('integration Preview deploy is enabled after DB migration while main stays explicit', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const enabled = config.git?.deploymentEnabled ?? {};

  assert.equal(
    enabled.main,
    false,
    'main must not auto-deploy to Production; Production release is explicit',
  );
  assert.equal(
    enabled['security-integration-final-20260926'],
    true,
    'integration Preview deploy is enabled after Preview DB migration is complete',
  );
});
