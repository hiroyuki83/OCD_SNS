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
