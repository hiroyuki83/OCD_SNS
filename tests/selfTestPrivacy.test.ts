import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const SELF_TEST_PRISMA_ACCESS = /prisma\.(?:ybocsResult|iesrResult|itqResult|lsasResult)\b/;

function collectSourceFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function filesUsingSelfTestModels(roots: string[]) {
  return roots
    .flatMap(collectSourceFiles)
    .filter((file) => SELF_TEST_PRISMA_ACCESS.test(readFileSync(file, 'utf8')))
    .map((file) => file.replace(process.cwd(), ''));
}

test('admin surfaces do not directly read psychological self-test models', () => {
  assert.deepEqual(
    filesUsingSelfTestModels([
      join(process.cwd(), 'src', 'app', 'admin'),
      join(process.cwd(), 'src', 'app', 'api', 'admin'),
    ]),
    [],
  );
});

test('moderation surfaces do not directly read psychological self-test models', () => {
  assert.deepEqual(
    filesUsingSelfTestModels([
      join(process.cwd(), 'src', 'app', 'moderation'),
      join(process.cwd(), 'src', 'components', 'moderation'),
    ]),
    [],
  );
});

test('public profile and user API do not read psychological self-test models', () => {
  assert.deepEqual(
    filesUsingSelfTestModels([
      join(process.cwd(), 'src', 'app', 'user'),
      join(process.cwd(), 'src', 'app', 'api', 'user'),
      join(process.cwd(), 'src', 'app', 'api', 'user-handle'),
    ]),
    [],
  );
});

test('self-test history queries are owner-scoped by userId', () => {
  const page = readFileSync(join(process.cwd(), 'src', 'app', 'test', 'page.tsx'), 'utf8');
  for (const model of ['ybocsResult', 'iesrResult', 'itqResult', 'lsasResult']) {
    const modelQuery = new RegExp(
      String.raw`prisma\.${model}\.findMany\(\{[\s\S]*?where:\s*\{\s*userId\s*\}`,
    );
    assert.match(page, modelQuery, `${model} history must be scoped to the authenticated user`);
  }
});


test('self-test submissions derive ownership from the authenticated session, not FormData', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'app', 'lib', 'actions.ts'), 'utf8');

  for (const actionName of ['submitYbocs', 'submitIesr', 'submitItq', 'submitLsas']) {
    const start = actions.indexOf(`export async function ${actionName}`);
    assert.ok(start >= 0, `${actionName} must exist`);

    const nextExport = actions.indexOf('\nexport ', start + 1);
    const body = actions.slice(start, nextExport >= 0 ? nextExport : actions.length);

    assert.match(body, /const session = await auth\(\)/, `${actionName} must authenticate`);
    assert.match(body, /userId = session\?\.user\?\.id/, `${actionName} must resolve session userId`);
    assert.doesNotMatch(body, /formData\.get\(['"]userId['"]\)/, `${actionName} must not accept owner userId from FormData`);
    assert.match(body, /data:\s*\{\s*userId,/, `${actionName} must persist with the authenticated userId`);
  }
});

test('self-test deletion is owner-scoped for every model', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'app', 'lib', 'actions.ts'), 'utf8');
  const start = actions.indexOf('export async function deleteSelfTestResult');
  assert.ok(start >= 0, 'deleteSelfTestResult must exist');

  const nextExport = actions.indexOf('\nexport ', start + 1);
  const body = actions.slice(start, nextExport >= 0 ? nextExport : actions.length);

  assert.match(body, /const session = await auth\(\)/);
  assert.match(body, /userId = session\?\.user\?\.id/);
  assert.doesNotMatch(body, /formData\.get\(['"]userId['"]\)/);

  for (const model of ['ybocsResult', 'iesrResult', 'itqResult', 'lsasResult']) {
    const ownerScopedDelete = new RegExp(
      String.raw`prisma\.${model}\.deleteMany\(\{\s*where:\s*\{\s*id:\s*resultId,\s*userId\s*\}\s*\}\)`,
    );
    assert.match(body, ownerScopedDelete, `${model} deletion must require id + authenticated userId`);
  }
});

test('ITQ free-text event description is not persisted', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'app', 'lib', 'actions.ts'), 'utf8');
  const start = actions.indexOf('export async function submitItq');
  assert.ok(start >= 0, 'submitItq must exist');

  const nextExport = actions.indexOf('\nexport ', start + 1);
  const body = actions.slice(start, nextExport >= 0 ? nextExport : actions.length);

  assert.match(body, /eventDescription:\s*null/);
  assert.doesNotMatch(body, /formData\.get\(['"]eventDescription['"]\)/);
});
