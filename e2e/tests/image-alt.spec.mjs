import { test, expect } from '@playwright/test';
import { login, USERS } from './helpers.mjs';

const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHxcCAk+Uzr4AAAAASUVORK5CYII=',
  'base64',
);

test('saves and renders post image alt text', async ({ page }) => {
  const content = 'E2E alt text post #alt-e2e';
  const alt = 'E2E用の2ピクセル四方画像';

  await login(page, USERS.public1);
  await page.goto('/?compose=1');

  await page.getByLabel('投稿本文').fill(content);
  await page.locator('input[name="image"]').setInputFiles({
    name: 'e2e-two-pixel.png',
    mimeType: 'image/png',
    buffer: TEST_PNG,
  });

  await page.getByLabel('画像の説明（任意）').fill(alt);
  await page.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(page.getByText('投稿しました。')).toBeVisible();

  await page.goto('/profile');
  const contentNode = page.getByText(content, { exact: true });
  await expect(contentNode).toBeVisible();
  const card = contentNode.locator('xpath=ancestor::div[contains(@class,"border-b")][1]');
  await expect(card.getByRole('img', { name: alt })).toBeVisible();
});
