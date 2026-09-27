import { test, expect } from '@playwright/test';
import {
  enrollStaffMfa,
  login,
  PREVIEW_PASSWORD,
  USERS,
} from './helpers.mjs';

test.describe.serial('staff MFA gate', () => {
  let recoveryCode = '';

  test('redirects admin to MFA setup before privileged access', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/settings\?mfa=required$/);
    await expect(
      page.getByText('ADMIN / MODERATORとして管理機能を使うには'),
    ).toBeVisible();
  });

  test('enrolls TOTP and unlocks admin access with a recovery code', async ({ page }) => {
    const enrollment = await enrollStaffMfa(page, USERS.admin, PREVIEW_PASSWORD);
    recoveryCode = enrollment.recoveryCodes[0] ?? '';
    expect(recoveryCode.length).toBeGreaterThan(10);

    await page.goto('/login');
    await page.getByLabel('メールアドレス').fill(USERS.admin);
    await page.getByLabel('パスワード').fill(PREVIEW_PASSWORD);
    await page.getByLabel('リカバリーコード').fill(recoveryCode);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '管理トップ' })).toBeVisible();
  });
});
