import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(full)) {
      files.push(full.split(path.sep).join('/'));
    }
  }
  return files;
}

const ALLOWED_DIRECT_CONSOLE = new Set([
  'src/lib/operationalError.ts',
]);

test('application source uses centralized privacy-safe operational logging', () => {
  const consoleCall = /\bconsole\.(error|warn|log|info|debug)\s*\(/g;
  const violations: string[] = [];

  for (const file of walk('src')) {
    if (ALLOWED_DIRECT_CONSOLE.has(file)) continue;

    const source = readFileSync(file, 'utf8');
    const matches = [...source.matchAll(consoleCall)];
    for (const match of matches) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push(`${file}:${line} uses direct console.${match[1]}()`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      'Direct console logging can expose exception messages, stack traces, or user data.',
      'Use logOperationalError() or another explicitly privacy-reviewed logger instead.',
      ...violations,
    ].join('\n'),
  );
});

test('privacy-safe operational logger serializes only approved fields', () => {
  const source = readFileSync('src/lib/operationalError.ts', 'utf8');

  assert.match(source, /incidentId/);
  assert.match(source, /event/);
  assert.match(source, /errorName/);
  assert.match(source, /occurredAt/);
  assert.doesNotMatch(source, /error\.message/);
  assert.doesNotMatch(source, /error\.stack/);
});


test('transactional email failures never embed provider response bodies in errors', () => {
  const source = readFileSync('src/lib/email.ts', 'utf8');

  assert.doesNotMatch(source, /response\.text\s*\(/);
  assert.doesNotMatch(source, /Failed to send transactional email:.*body/);
  assert.match(source, /Transactional email provider returned HTTP/);
});


test('transactional email provider calls have a hard timeout and never follow redirects', () => {
  const source = readFileSync('src/lib/email.ts', 'utf8');

  assert.match(source, /EMAIL_PROVIDER_TIMEOUT_MS = 10_000/);
  assert.match(source, /AbortSignal\.timeout\(EMAIL_PROVIDER_TIMEOUT_MS\)/);
  assert.match(source, /redirect: 'error'/);
});
