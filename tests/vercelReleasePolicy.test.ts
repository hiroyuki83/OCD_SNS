import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Production stays explicit while the fixed Preview branch auto-deploys', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const enabled = config.git?.deploymentEnabled ?? {};

  assert.equal(
    enabled.main,
    false,
    'main must not auto-deploy to Production; Production release is explicit',
  );
  assert.equal(
    enabled.preview,
    true,
    'the long-lived preview branch must auto-deploy to the fixed Vercel Preview alias',
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(enabled, 'security-integration-final-20260926'),
    false,
    'completed integration branch deployment settings should be removed',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(enabled, 'feature/sanction-records-20260928'),
    false,
    'completed sanction branch deployment settings should be removed',
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(enabled, 'feature/sanction-appeals-20260928'),
    false,
    'completed sanction appeal branch deployment settings should be removed',
  );
});
