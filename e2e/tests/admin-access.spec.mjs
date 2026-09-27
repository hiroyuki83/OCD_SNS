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
  const password = section.locator('#admin-current-password');
  const roleSelect = section.locator('#admin-user-role');
  const statusSelect = section.locator('#admin-user-status');
  const sanctionSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: '処分履歴' }),
  });

  async function saveRole(role) {
    await password.fill(PREVIEW_PASSWORD);
    await roleSelect.selectOption(role);
    page.once('dialog', (dialog) => dialog.accept());
    await section.getByRole('button', { name: '権限を更新' }).click();
    await expect(password).toHaveValue('');
    await page.reload();
    await expect(roleSelect).toHaveValue(role);
  }

  async function saveStatus(status, reason = null) {
    await password.fill(PREVIEW_PASSWORD);
    await statusSelect.selectOption(status);
    if (reason) {
      page.once('dialog', (dialog) => dialog.accept(reason));
    }
    await section.getByRole('button', { name: '状態を更新' }).click();
    await expect(password).toHaveValue('');
    await page.reload();
    await expect(statusSelect).toHaveValue(status);
  }

  await saveRole('MODERATOR');
  await saveRole('USER');

  const restrictionReason = 'E2E投稿制限理由です';
  await saveStatus('POST_RESTRICTED', restrictionReason);
  const restrictionCard = sanctionSection.locator('div.rounded-md').filter({
    hasText: restrictionReason,
  });
  await expect(restrictionCard).toContainText('投稿制限');
  await expect(restrictionCard).toContainText('状態: 有効');

  await saveStatus('ACTIVE');
  await expect(restrictionCard).toContainText('状態: 解除済み');

  const suspensionReason = 'E2E停止理由です';
  await saveStatus('SUSPENDED', suspensionReason);
  const suspensionCard = sanctionSection.locator('div.rounded-md').filter({
    hasText: suspensionReason,
  });
  await expect(suspensionCard).toContainText('アカウント停止');
  await expect(suspensionCard).toContainText('状態: 有効');

  await saveStatus('ACTIVE');
  await expect(suspensionCard).toContainText('状態: 解除済み');
});
