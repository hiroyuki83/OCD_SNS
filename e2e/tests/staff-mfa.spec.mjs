import { test, expect } from '@playwright/test';
import { login, PREVIEW_PASSWORD, USERS, totpCode } from './helpers.mjs';

test.describe.serial('staff MFA gate', () => {
  let secret = '';
  let recoveryCode = '';

  test('redirects admin to MFA setup before privileged access', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/settings\?mfa=required$/);
    await expect(
      page.getByText('ADMIN / MODERATORとして管理機能を使うには'),
    ).toBeVisible();
  });

  test('enrolls TOTP and unlocks admin access', async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto('/settings?mfa=required');

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'スタッフ2段階認証' }),
    });

    await section.getByLabel('現在のパスワード').first().fill(PREVIEW_PASSWORD);
    await section
      .getByRole('button', { name: '2段階認証の登録を開始' })
      .click();

    await expect(section.getByText('秘密鍵')).toBeVisible();
    secret = (await section.locator('code').first().textContent())?.trim() ?? '';
    expect(secret.length).toBeGreaterThan(10);

    const enrollment = section
      .getByRole('button', { name: 'コードを確認して有効化' })
      .locator('xpath=ancestor::form');
    await enrollment.getByLabel('現在のパスワード').fill(PREVIEW_PASSWORD);
    await enrollment.getByLabel('6桁コード').fill(totpCode(secret));
    await enrollment
      .getByRole('button', { name: 'コードを確認して有効化' })
      .click();

    await expect(
      section.getByText('リカバリーコードを保存してください'),
    ).toBeVisible();
    recoveryCode = (await section.locator('code').first().textContent())?.trim() ?? '';
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
