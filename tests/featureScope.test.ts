import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
const migrationPath = join(
  process.cwd(),
  'prisma',
  'migrations',
  '20260928013000_remove_reply_and_quote_post',
  'migration.sql',
);

function sourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

test('Prisma schema does not define the legacy Reply model', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  assert.doesNotMatch(schema, /\bmodel\s+Reply\b/);
  assert.doesNotMatch(schema, /\bReply\[\]/);
});

test('Prisma schema does not define quote-post relations', () => {
  const schema = readFileSync(schemaPath, 'utf8');
  assert.doesNotMatch(schema, /\bquotePostId\b/);
  assert.doesNotMatch(schema, /\bquotePost\b/);
  assert.doesNotMatch(schema, /\bquotedBy\b/);
  assert.doesNotMatch(schema, /@relation\("QuotePost"/);
});

test('application source does not use Reply Prisma APIs', () => {
  const matches = sourceFiles(join(process.cwd(), 'src')).filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /\bprisma\.reply\b|\bReply(?:Create|Update|Where|GetPayload|Unchecked)?Input\b/.test(source);
  });
  assert.deepEqual(matches, []);
});

test('application source does not use quote-post Prisma fields', () => {
  const matches = sourceFiles(join(process.cwd(), 'src')).filter((file) => {
    const source = readFileSync(file, 'utf8');
    return /\bquotePostId\b|\bquotedBy\b|@relation\("QuotePost"/.test(source);
  });
  assert.deepEqual(matches, []);
});

test('removal migration drops the Reply table', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /DROP TABLE IF EXISTS "Reply"/);
});

test('removal migration drops quote-post foreign key and column', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /DROP CONSTRAINT IF EXISTS "Post_quotePostId_fkey"/);
  assert.match(migration, /DROP COLUMN IF EXISTS "quotePostId"/);
});
