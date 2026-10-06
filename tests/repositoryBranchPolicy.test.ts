import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('repository cleanup can never delete the long-lived Preview acceptance branch', () => {
  const source = readFileSync('.github/workflows/repository-branch-cleanup.yml', 'utf8');

  assert.ok(source.includes('[ "${BRANCH_NAME}" != "preview" ]'));
  assert.ok(source.includes('preview is the long-lived acceptance branch'));
});

test('repository inventory classifies preview as retained rather than safe-delete', () => {
  const source = readFileSync('.github/workflows/repository-branch-inventory.yml', 'utf8');

  assert.ok(source.includes('classification="retained-preview"'));
  assert.ok(source.includes('retained-preview = long-lived Preview acceptance branch'));
});
