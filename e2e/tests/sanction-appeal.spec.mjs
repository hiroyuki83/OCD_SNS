import { test, expect } from '@playwright/test';
import {
  enrollStaffMfa,
  login,
  loginStaffWithRecoveryCode,
  PREVIEW_PASSWORD,
  USERS,
} from './helpers.mjs';

test('suspended user can appeal without a login session and regain access after overturn', async ({ browser }) => {
  const token = Date.now().toString(36);
  const issuerContext = await browser.newContext();
  const reviewerContext = await browser.newContext();
  const userContext = await browser.newContext();

  const issuer = await issuerContext.newPage();
  const reviewer = await reviewerContext.newPage();
  const user = await userContext.newPage();

  const suspensionReason = `E2E停止Appeal理由です ${token}`;
  const appealMessage = `停止処分について再確認をお願いします。 ${token}`;
  const reviewNote = `E2E審査で停止処分取消を確認しました ${token}`;

  const issuerMfa = await enrollStaffMfa(issuer, USERS.admin4, PREVIEW_PASSWORD);
  const issuerRecoveryCode = issuerMfa.recoveryCodes[0] ?? '';
  expect(issuerRecoveryCode.length).toBeGreaterThan(10);
  await loginStaffWithRecoveryCode(
    issuer,
    USERS.admin4,
    issuerRecoveryCode,
    PREVIEW_PASSWORD,
  );

  await issuer.goto(`/admin/users?q=${encodeURIComponent(USERS.appeal)}`);
  await issuer
    .getByRole('link', { name: 'Preview Appeal User', exact: true })
    .click();

  const accessSection = issuer.locator('section').filter({
    has: issuer.getByRole('heading', { name: '権限とアカウント状態' }),
  });
  const password = accessSection.locator('#admin-current-password');
  const statusSelect = accessSection.locator('#admin-user-status');

  await password.fill(PREVIEW_PASSWORD);
  await statusSelect.selectOption('SUSPENDED');
  issuer.once('dialog', (dialog) => dialog.accept(suspensionReason));
  await accessSection.getByRole('button', { name: '状態を更新' }).click();
  await expect(password).toHaveValue('');
  await issuer.reload();
  await expect(statusSelect).toHaveValue('SUSPENDED');

  await user.goto('/login');
  await user.getByLabel('メールアドレス').fill(USERS.appeal);
  await user.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
  await user
    .locator('#main-content')
    .getByRole('button', { name: 'ログイン', exact: true })
    .click();
  await expect(user).toHaveURL(/\/login/);
  await expect(
    user.locator('p[role="alert"]').filter({
      hasText: 'メールアドレス、パスワード、または必要な2段階認証を確認してください。',
    }),
  ).toBeVisible();

  await user.getByRole('link', { name: '投稿制限・停止への異議申立て' }).click();
  await expect(
    user.getByRole('heading', { name: '処分への異議申立て' }),
  ).toBeVisible();

  await user.getByLabel('登録メールアドレス').fill(USERS.appeal);
  await user.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
  await user
    .getByRole('button', { name: '異議申立てを送信・状況確認' })
    .click();

  await expect(
    user.getByText(
      '現在の処分内容を確認しました。異議申立てを送信する場合は、理由を10文字以上で入力してください。',
    ),
  ).toBeVisible();
  await expect(user.getByText(suspensionReason)).toBeVisible();

  await user.getByLabel('異議申立ての理由').fill(appealMessage);
  await user
    .getByRole('button', { name: '異議申立てを送信・状況確認' })
    .click();

  await expect(user.getByText('異議申立ては審査中です。')).toBeVisible();
  await expect(user.getByText('アカウント停止', { exact: true })).toBeVisible();
  await expect(user.getByText('審査中', { exact: true })).toBeVisible();

  const reviewerMfa = await enrollStaffMfa(reviewer, USERS.admin5, PREVIEW_PASSWORD);
  const reviewerRecoveryCode = reviewerMfa.recoveryCodes[0] ?? '';
  expect(reviewerRecoveryCode.length).toBeGreaterThan(10);
  await loginStaffWithRecoveryCode(
    reviewer,
    USERS.admin5,
    reviewerRecoveryCode,
    PREVIEW_PASSWORD,
  );

  await reviewer.goto('/moderation/appeals/sanctions');
  const appealCard = reviewer
    .locator('[data-sanction-appeal-card]')
    .filter({ hasText: appealMessage });
  await expect(appealCard).toBeVisible();
  await expect(appealCard).toContainText(suspensionReason);

  await appealCard.getByLabel('審査理由').fill(reviewNote);
  const overturnButton = appealCard.getByRole('button', {
    name: '処分を取り消す',
  });
  await overturnButton.click();

  await expect(overturnButton).toHaveCount(0, { timeout: 15_000 });
  await expect(appealCard.getByText('処分取消', { exact: true })).toBeVisible();
  await expect(appealCard.getByText(reviewNote)).toBeVisible();

  await user.goto('/appeal');
  await user.getByLabel('登録メールアドレス').fill(USERS.appeal);
  await user.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
  await user
    .getByRole('button', { name: '異議申立てを送信・状況確認' })
    .click();

  await expect(
    user.getByText('異議申立ての審査が完了し、処分は取り消されました。'),
  ).toBeVisible();
  await expect(user.getByText(reviewNote)).toBeVisible();

  await login(user, USERS.appeal, PREVIEW_PASSWORD);

  await Promise.all([
    issuerContext.close(),
    reviewerContext.close(),
    userContext.close(),
  ]);
});
