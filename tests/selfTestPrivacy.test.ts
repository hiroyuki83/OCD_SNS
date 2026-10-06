import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const SELF_TEST_PRISMA_ACCESS =
  /prisma\.(?:selfAssessmentResult|ybocsResult|iesrResult|itqResult|lsasResult)\b/;

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

test('generic self-assessment history query is owner-scoped by userId and assessmentKey', () => {
  const page = readFileSync(join(process.cwd(), 'src', 'app', 'test', 'page.tsx'), 'utf8');
  assert.match(
    page,
    /prisma\.selfAssessmentResult\.findMany\(\{[\s\S]*?where:\s*\{[\s\S]*?userId,[\s\S]*?assessmentKey:\s*activeTab/,
  );
});

test('generic self-assessment submission derives ownership from the authenticated session', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'app', 'test', 'actions.ts'), 'utf8');
  assert.match(actions, /const userId = await resolveUserId\(\)/);
  assert.match(actions, /await prisma\.selfAssessmentResult\.create/);
  assert.match(actions, /userId,/);
  assert.doesNotMatch(actions, /formData\.get\(['"]userId['"]\)/);
});

test('generic self-assessment deletion is owner and assessment scoped', () => {
  const actions = readFileSync(join(process.cwd(), 'src', 'app', 'test', 'actions.ts'), 'utf8');
  assert.match(
    actions,
    /prisma\.selfAssessmentResult\.deleteMany\(\{[\s\S]*?id:\s*resultId,[\s\S]*?userId,[\s\S]*?assessmentKey/,
  );
});

test('legacy copyrighted questionnaire forms are no longer served from the test components directory', () => {
  const root = join(process.cwd(), 'src', 'components', 'test');
  for (const file of ['YbocsForm.tsx', 'IesrForm.tsx', 'ItqForm.tsx', 'LsasForm.tsx']) {
    assert.equal(existsSync(join(root, file)), false, file + ' should be removed');
  }
});
