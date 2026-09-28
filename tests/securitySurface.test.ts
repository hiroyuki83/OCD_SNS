import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full.split(path.sep).join('/'));
    }
  }

  return files;
}

function read(file: string) {
  return readFileSync(file, 'utf8');
}

const apiRoutes = walk('src/app/api').filter((file) => file.endsWith('/route.ts'));
const serverActions = walk('src/app').filter((file) => file.endsWith('/actions.ts'));
const sourceFiles = walk('src').filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));

const PUBLIC_SERVER_ACTIONS = new Set([
  'src/app/appeal/actions.ts',
  'src/app/password-reset/actions.ts',
  'src/app/verify-email/actions.ts',
]);

const AUTH_MARKERS = [
  /\bauth\(\)/,
  /\brequireRole\(/,
  /\brequireAnyRole\(/,
  /\bcheckRoleApi\(/,
  /\bcheckAnyRoleApi\(/,
  /\brequireRoleApi\(/,
  /\brequireAnyRoleApi\(/,
];

test('every explicit API mutation route uses shared mutation request security, auth, and rate limiting', () => {
  const mutationExport = /export\s+async\s+function\s+(POST|PATCH|PUT|DELETE)\b/;

  for (const file of apiRoutes) {
    const source = read(file);
    if (!mutationExport.test(source)) continue;

    assert.match(
      source,
      /parseJsonMutationRequest\(/,
      `${file} exports a mutation handler without parseJsonMutationRequest()`,
    );
    assert.match(
      source,
      /rateLimit\(/,
      `${file} exports a mutation handler without rateLimit()`,
    );
    assert.ok(
      AUTH_MARKERS.some((pattern) => pattern.test(source)),
      `${file} exports a mutation handler without an approved auth/RBAC guard`,
    );
  }
});

test('all App Router server action modules are explicit and rate limited', () => {
  assert.ok(serverActions.length > 0, 'expected at least one Server Action module');

  for (const file of serverActions) {
    const source = read(file);

    assert.match(
      source,
      /^['"]use server['"];?/m,
      `${file} must declare use server explicitly`,
    );
    assert.match(
      source,
      /rateLimit\(/,
      `${file} must rate-limit state-changing Server Actions`,
    );
  }
});

test('authenticated Server Action modules retain an auth or RBAC guard', () => {
  for (const file of serverActions) {
    if (PUBLIC_SERVER_ACTIONS.has(file)) continue;

    const source = read(file);
    assert.ok(
      AUTH_MARKERS.some((pattern) => pattern.test(source)),
      `${file} is not an approved public flow and lacks an auth/RBAC guard`,
    );
  }
});

test('public Server Action flows retain schema validation plus rate limiting', () => {
  for (const file of PUBLIC_SERVER_ACTIONS) {
    const source = read(file);

    assert.match(source, /rateLimit\(/, `${file} must remain rate limited`);
    assert.ok(
      /\bz\./.test(source) || /from ['"]zod['"]/.test(source),
      `${file} must retain explicit schema validation`,
    );
  }
});

test('application source does not introduce high-risk dynamic execution or unsafe raw SQL helpers', () => {
  const banned: Array<[RegExp, string]> = [
    [/dangerouslySetInnerHTML/, 'dangerouslySetInnerHTML'],
    [/\$queryRawUnsafe\s*\(/, '$queryRawUnsafe()'],
    [/\$executeRawUnsafe\s*\(/, '$executeRawUnsafe()'],
    [/\beval\s*\(/, 'eval()'],
    [/\bnew\s+Function\s*\(/, 'new Function()'],
    [/from\s+['"]node:child_process['"]|from\s+['"]child_process['"]|require\(['"](?:node:)?child_process['"]\)/, 'child_process'],
  ];

  for (const file of sourceFiles) {
    const source = read(file);
    for (const [pattern, label] of banned) {
      assert.doesNotMatch(
        source,
        pattern,
        `${file} introduced banned high-risk primitive: ${label}`,
      );
    }
  }
});
