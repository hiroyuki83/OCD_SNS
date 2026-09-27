import { test, expect } from '@playwright/test';
import {
  enrollStaffMfa,
  loginStaffWithRecoveryCode,
  PREVIEW_PASSWORD,
  USERS,
} from './helpers.mjs';

test('ADMIN can change and restore a user role and account status', async ({ page }) => {
  const mfa = await enrollStaffMfa(page, USERS.admin3, PREVIEW_PASSWORD);
  const recoveryCode = mfa.recoveryCodes[0] ?? '';
  expect(recoveryCode.length).toBeGreaterThan(10);
  await loginStaffWithRecoveryCode(page, USERS.admin3, recoveryCode, PREVIEW_PASSWORD);

  await page.goto(`/admin/users?q=${encodeURIComponent(USERS.public2)}`);
  await page.getByRole('link', { name: 'Preview 公開ユーザー2', exact: true }).click();

  const section = page.locator('section').filter({
    has: page.getByRole('heading', { name: '権限とアカウント状態' }),
  });
  const password = section.getByLabel('操作確認用のADMINパスワード');
  const roleSelect = section.getByLabel('権限');
  const statusSelect = section.getByLabel('アカウント状態');

  await password.fill(PREVIEW_PASSWORD);
  await roleSelect.selectOption('MODERATOR');
  page.once('dialog', (dialog) => dialog.accept());
  await section.getByRole('button', { name: '権限を更新' }).click();
  await expect(roleSelect).toHaveValue('MODERATOR');

  await password.fill(PREVIEW_PASSWORD);
  await roleSelect.selectOption('USER');
  page.once('dialog', (dialog) => dialog.accept());
  await section.getByRole('button', { name: '権限を更新' }).click();
  await expect(roleSelect).toHaveValue('USER');

  await password.fill(PREVIEW_PASSWORD);
  await statusSelect.selectOption('POST_RESTRICTED');
  page.once('dialog', (dialog) => dialog.accept('E2E投稿制限理由です'));
  await section.getByRole('button', { name: '状態を更新' }).click();
  await expect(statusSelect).toHaveValue('POST_RESTRICTED');

  await password.fill(PREVIEW_PASSWORD);
  await statusSelect.selectOption('ACTIVE');
  await section.getByRole('button', { name: '状態を更新' }).click();
  await expect(statusSelect).toHaveValue('ACTIVE');

  await password.fill(PREVIEW_PASSWORD);
  await statusSelect.selectOption('SUSPENDED');
  page.once('dialog', (dialog) => dialog.accept('E2E停止理由です'));
  await section.getByRole('button', { name: '状態を更新' }).click();
  await expect(statusSelect).toHaveValue('SUSPENDED');

  await password.fill(PREVIEW_PASSWORD);
  await statusSelect.selectOption('ACTIVE');
  await section.getByRole('button', { name: '状態を更新' }).click();
  await expect(statusSelect).toHaveValue('ACTIVE');
});
