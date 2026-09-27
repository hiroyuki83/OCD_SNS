import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const path of [
  '.github/workflows/security-integration-ci.yml',
  '.github/workflows/e2e.yml',
]) {
  test(`${path} runs on PR validation and post-merge main, not integration push`, () => {
    const source = readFileSync(path, 'utf8');

    assert.match(source, /pull_request:\s*\n\s*branches:\s*\n\s*- main/);
    assert.match(source, /push:\s*\n\s*branches:\s*\n\s*- main/);

    const pushBlock = source.match(/push:\s*\n\s*branches:\s*\n(?:\s*- .*\n)*/)?.[0] ?? '';
    assert.ok(!pushBlock.includes('security-integration-final-20260926'));
  });
}
