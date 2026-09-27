import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.mjs';

test('keyboard and landmark basics are available', async ({ page }) => {
  await page.goto('/login');

  const skip = page.getByRole('link', { name: '本文へ移動' });
  await skip.focus();
  await expect(skip).toBeFocused();
  await expect(page.locator('main#main-content')).toHaveCount(1);

  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel('パスワード')).toBeVisible();

  await login(page, USERS.public1);
  await expect(page.getByRole('navigation', { name: '主要ナビゲーション' })).toBeVisible();
  await expect(page.getByLabel('投稿本文')).toBeVisible();

  await page.goto('/explore');
  await expect(
    page.getByLabel('投稿、ユーザー、@handle、ハッシュタグを検索'),
  ).toBeVisible();
});
