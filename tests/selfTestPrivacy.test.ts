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
