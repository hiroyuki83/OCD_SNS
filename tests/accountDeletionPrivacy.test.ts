import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'src', 'app', 'settings', 'account-actions.ts'),
  'utf8',
);

test('account deletion removes sensitive self-test and authentication records', () => {
  for (const model of [
    'ybocsResult',
    'iesrResult',
    'itqResult',
    'lsasResult',
    'passwordResetToken',
    'emailVerificationToken',
    'staffRecoveryCode',
  ]) {
    assert.match(source, new RegExp(String.raw`tx\.${model}\.deleteMany`));
  }
});

test('account deletion scrubs posts and anonymizes credentials', () => {
  assert.match(source, /content: '\[削除済み\]'/);
  assert.match(source, /imageUrl: null/);
  assert.match(source, /emailVerifiedAt: null/);
  assert.match(source, /status: AccountStatus\.SUSPENDED/);
  assert.match(source, /sessionVersion: \{ increment: 1 \}/);
});

test('staff accounts cannot use self-service deletion', () => {
  assert.match(source, /user\.role !== Role\.USER/);
});


test('account deletion scrubs sanction appeal messages', () => {
  assert.match(source, /tx\.appeal\.updateMany/);
  assert.match(source, /\[削除済みユーザーによる異議申立て\]/);
});


test('account deletion collects and removes profile and post blobs after anonymization', () => {
  assert.match(
    source,
    /select:\s*\{[\s\S]*?avatarUrl:\s*true,[\s\S]*?headerUrl:\s*true,[\s\S]*?\}/,
  );
  assert.match(
    source,
    /prisma\.post\.findMany\(\{[\s\S]*?where:\s*\{\s*authorId:\s*userId\s*\}[\s\S]*?select:\s*\{\s*id:\s*true,\s*imageUrl:\s*true\s*\}/,
  );
  assert.match(
    source,
    /const blobUrls = \[[\s\S]*?user\.avatarUrl,[\s\S]*?user\.headerUrl,[\s\S]*?\.\.\.posts\.map\(\(post\) => post\.imageUrl\),[\s\S]*?\]/,
  );
  assert.match(source, /imageUrl:\s*null/);
  assert.match(source, /imageAlt:\s*null/);

  const transactionEnd = source.indexOf('if (!deleted)');
  const cleanupCall = source.indexOf('await deleteManagedBlobs(blobUrls)');
  const signOutCall = source.indexOf("await signOut({ redirectTo: '/login?account=deleted' })");

  assert.ok(transactionEnd >= 0, 'account deletion transaction result must be checked');
  assert.ok(cleanupCall > transactionEnd, 'blob cleanup must happen only after confirmed DB anonymization');
  assert.ok(signOutCall > cleanupCall, 'blob cleanup must be requested before sign-out');
});

test('managed blob cleanup refuses arbitrary external URLs', () => {
  const blobCleanup = readFileSync(
    join(process.cwd(), 'src', 'lib', 'blobCleanup.ts'),
    'utf8',
  );

  assert.match(blobCleanup, /url\.protocol === 'https:'/);
  assert.match(blobCleanup, /\.public\.blob\.vercel-storage\.com/);
  assert.match(blobCleanup, /if \(!url \|\| !isManagedBlobUrl\(url\)\) return false/);
});
