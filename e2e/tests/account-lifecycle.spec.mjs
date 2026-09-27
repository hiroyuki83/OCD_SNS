import { test, expect } from '@playwright/test';
import { login, verificationUrlFor } from './helpers.mjs';

const OLD_EMAIL = 'coco.e2e.lifecycle@example.com';
const NEW_EMAIL = 'coco.e2e.lifecycle.changed@example.com';
const PASSWORD = 'E2eLifecyclePass123!';

test('verified email change and account deletion lifecycle', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('名前').fill('E2E ライフサイクル');
  await page.getByLabel('メールアドレス').fill(OLD_EMAIL);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: '新規登録' }).click();
  await expect(page.getByRole('status')).toContainText('確認メールを送信しました');

  const registrationVerificationUrl = await verificationUrlFor(OLD_EMAIL);
  await page.goto(registrationVerificationUrl);
  await page.getByRole('button', { name: 'メールアドレスを確認' }).click();
  await expect(page.getByRole('status')).toContainText('メールアドレスを確認しました');

  await login(page, OLD_EMAIL, PASSWORD);
  await page.goto('/settings');

  const emailSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'メールアドレス変更' }),
  });
  await emailSection.getByLabel('新しいメールアドレス').fill(NEW_EMAIL);
  await emailSection.getByLabel('現在のパスワード').fill(PASSWORD);
  await emailSection.getByRole('button', { name: '変更確認メールを送信' }).click();
  await expect(emailSection.getByRole('status')).toContainText('確認メールを送信しました');

  const emailChangeVerificationUrl = await verificationUrlFor(NEW_EMAIL);
  await page.goto(emailChangeVerificationUrl);
  await page.getByRole('button', { name: 'メールアドレスを確認' }).click();
  await expect(page.getByRole('status')).toContainText('メールアドレスを変更しました');

  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(OLD_EMAIL);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.locator('#main-content').getByRole('alert')).toContainText('確認してください');

  await login(page, NEW_EMAIL, PASSWORD);
  await page.goto('/settings');

  const deletionSection = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'アカウント削除' }),
  });
  await deletionSection.getByLabel('現在のパスワード').fill(PASSWORD);
  await deletionSection.getByLabel('確認のため「削除する」と入力').fill('削除する');
  page.once('dialog', (dialog) => dialog.accept());
  await deletionSection.getByRole('button', { name: 'アカウントを削除' }).click();
  await expect(page).toHaveURL(/\/login\?account=deleted$/);

  await page.getByLabel('メールアドレス').fill(NEW_EMAIL);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page.locator('#main-content').getByRole('alert')).toContainText('確認してください');
});
