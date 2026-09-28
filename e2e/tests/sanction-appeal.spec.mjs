import { test, expect } from '@playwright/test';
import {
  enrollStaffMfa,
  latestEmailFor,
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
  const restrictionReason = `E2E投稿制限Appeal理由です ${token}`;
  const restrictionAppealMessage = `投稿制限について再確認をお願いします。 ${token}`;
  const restrictionReviewNote = `E2E審査で投稿制限取消を確認しました ${token}`;
  const blockedPostContent = `E2E restricted post should not publish ${token}`;
  const restoredPostContent = `E2E post after restriction overturn ${token}`;

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
      '現在の処分内容を確認しました。異議申立てを送信する場合は、認証情報を再入力し、理由を10文字以上で入力してください。',
    ),
  ).toBeVisible();
  await expect(user.getByText(suspensionReason)).toBeVisible();

  await user.getByLabel('登録メールアドレス').fill(USERS.appeal);
  await user.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
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

  const resultEmail = await latestEmailFor(
    USERS.appeal,
    'CoCo 異議申立ての審査結果',
  );
  expect(resultEmail.text).toContain('結果: 処分取消');
  expect(resultEmail.text).toContain(reviewNote);

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

  await issuer.goto(`/admin/users?q=${encodeURIComponent(USERS.appeal)}`);
  await issuer
    .getByRole('link', { name: 'Preview Appeal User', exact: true })
    .click();

  const restrictionSection = issuer.locator('section').filter({
    has: issuer.getByRole('heading', { name: '権限とアカウント状態' }),
  });
  const restrictionAdminPassword = restrictionSection.locator('#admin-current-password');
  const restrictionStatusSelect = restrictionSection.locator('#admin-user-status');

  await restrictionAdminPassword.fill(PREVIEW_PASSWORD);
  await restrictionStatusSelect.selectOption('POST_RESTRICTED');
  issuer.once('dialog', (dialog) => dialog.accept(restrictionReason));
  await restrictionSection.getByRole('button', { name: '状態を更新' }).click();
  await expect(restrictionAdminPassword).toHaveValue('');
  await issuer.reload();
  await expect(restrictionStatusSelect).toHaveValue('POST_RESTRICTED');

  await user.goto('/?compose=1');
  await user.getByLabel('投稿本文').fill(blockedPostContent);
  await user.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(user.getByText(restrictionReason)).toBeVisible();
  await expect(user.getByText('投稿しました。')).toHaveCount(0);

  await user.goto('/settings');
  const appealSettingsSection = user.locator('section').filter({
    has: user.getByRole('heading', { name: '処分への異議申立て' }),
  });
  await appealSettingsSection
    .getByRole('link', { name: '異議申立て・状況確認' })
    .click();

  await user.getByLabel('登録メールアドレス').fill(USERS.appeal);
  await user.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
  await user
    .getByLabel('異議申立ての理由')
    .fill(restrictionAppealMessage);
  await user
    .getByRole('button', { name: '異議申立てを送信・状況確認' })
    .click();

  await expect(user.getByText('異議申立ては審査中です。')).toBeVisible();
  await expect(user.getByText('投稿制限', { exact: true })).toBeVisible();

  await reviewer.goto('/moderation/appeals/sanctions');
  const restrictionAppealCard = reviewer
    .locator('[data-sanction-appeal-card]')
    .filter({ hasText: restrictionAppealMessage });
  await expect(restrictionAppealCard).toBeVisible();
  await expect(restrictionAppealCard).toContainText(restrictionReason);

  await restrictionAppealCard
    .getByLabel('審査理由')
    .fill(restrictionReviewNote);
  const restrictionOverturnButton = restrictionAppealCard.getByRole('button', {
    name: '処分を取り消す',
  });
  await restrictionOverturnButton.click();

  await expect(restrictionOverturnButton).toHaveCount(0, { timeout: 15_000 });
  await expect(
    restrictionAppealCard.getByText('処分取消', { exact: true }),
  ).toBeVisible();
  await expect(restrictionAppealCard.getByText(restrictionReviewNote)).toBeVisible();

  const restrictionResultEmail = await latestEmailFor(
    USERS.appeal,
    'CoCo 異議申立ての審査結果',
  );
  expect(restrictionResultEmail.text).toContain('対象: 投稿制限');
  expect(restrictionResultEmail.text).toContain('結果: 処分取消');
  expect(restrictionResultEmail.text).toContain(restrictionReviewNote);

  await user.goto('/?compose=1');
  await user.getByLabel('投稿本文').fill(restoredPostContent);
  await user.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(user.getByText('投稿しました。')).toBeVisible();

  await Promise.all([
    issuerContext.close(),
    reviewerContext.close(),
    userContext.close(),
  ]);
});
