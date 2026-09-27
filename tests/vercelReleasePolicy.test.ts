import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Production and schema-changing Preview branches stay gated before explicit release', () => {
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
    'completed integration branch must no longer auto-deploy',
  );
  assert.equal(
    enabled['feature/sanction-records-20260928'],
    false,
    'sanction Preview deploy must stay disabled until its DB migration gate succeeds',
  );
});
