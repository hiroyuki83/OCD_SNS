import { test, expect } from '@playwright/test';
import { login, verificationUrlFor } from './helpers.mjs';

const EMAIL = 'coco.e2e.register@example.com';
const INITIAL_PASSWORD = 'E2eRegisterPass123!';
const NEW_PASSWORD = 'E2eChangedPass123!';

test.describe.serial('authentication lifecycle', () => {
  test('registers, verifies email, and logs in', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('名前').fill('E2E 登録ユーザー');
    await page.getByLabel('メールアドレス').fill(EMAIL);
    await page.getByLabel('パスワード').fill(INITIAL_PASSWORD);
    await page.getByRole('button', { name: '新規登録' }).click();

    await expect(page.getByRole('status')).toContainText('確認メールを送信しました');

    const verificationUrl = await verificationUrlFor(EMAIL);
    await page.goto(verificationUrl);
    await page.getByRole('button', { name: 'メールアドレスを確認' }).click();
    await expect(page.getByRole('status')).toContainText('メールアドレスを確認しました');

    await login(page, EMAIL, INITIAL_PASSWORD);
    await expect(page.getByText('おすすめ')).toBeVisible();
  });

  test('changes password and invalidates the old credential', async ({ page }) => {
    await login(page, EMAIL, INITIAL_PASSWORD);
    await page.goto('/settings');

    const section = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'パスワード変更' }),
    });
    await section.getByLabel('現在のパスワード').fill(INITIAL_PASSWORD);
    await section.getByLabel('新しいパスワード', { exact: true }).fill(NEW_PASSWORD);
    await section.getByLabel('新しいパスワード（確認）').fill(NEW_PASSWORD);
    await section.getByRole('button', { name: 'パスワードを変更' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('メールアドレス').fill(EMAIL);
    await page.getByLabel('パスワード').fill(INITIAL_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page.locator('#main-content').getByRole('alert')).toContainText('確認してください');

    await page.getByLabel('メールアドレス').fill(EMAIL);
    await page.getByLabel('パスワード').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('revokes all existing sessions', async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    const pageA = await first.newPage();
    const pageB = await second.newPage();

    await login(pageA, EMAIL, NEW_PASSWORD);
    await login(pageB, EMAIL, NEW_PASSWORD);

    await pageA.goto('/settings');
    const sessionSection = pageA.locator('section').filter({
      has: pageA.getByRole('heading', { name: 'ログイン中の端末' }),
    });
    await sessionSection.getByLabel('現在のパスワード').fill(NEW_PASSWORD);
    pageA.once('dialog', (dialog) => dialog.accept());
    await sessionSection
      .getByRole('button', { name: 'すべての端末からログアウト' })
      .click();
    await expect(pageA).toHaveURL(/\/login$/);

    await pageB.goto('/profile');
    await expect(pageB.getByText('プロフィールを見るには')).toBeVisible();

    await first.close();
    await second.close();
  });
});
