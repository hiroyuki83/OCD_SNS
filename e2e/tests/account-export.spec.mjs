import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { login, USERS } from './helpers.mjs';

test('downloads the authenticated user data export without secret fields', async ({ page }) => {
  await login(page, USERS.public1);
  await page.goto('/settings');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '自分のデータをダウンロード' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^coco-account-export-\d{4}-\d{2}-\d{2}\.json$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const payload = JSON.parse(await readFile(path, 'utf8'));

  expect(payload.format).toBe('coco-account-export-v1');
  expect(payload.account.email).toBe(USERS.public1);
  expect(payload.selfTests).toHaveProperty('ybocsResults');
  expect(payload.selfTests).toHaveProperty('iesrResults');
  expect(payload.selfTests).toHaveProperty('itqResults');
  expect(payload.selfTests).toHaveProperty('lsasResults');

  const serialized = JSON.stringify(payload);
  for (const forbidden of [
    'staffTotpSecretEncrypted',
    'codeHash',
    'tokenHash',
    'password hash',
  ]) {
    if (forbidden === 'password hash') continue;
    expect(serialized).not.toContain(forbidden);
  }
  expect(payload.exclusions).toContain('password hash');
  expect(payload.exclusions).toContain('internal admin notes');
  expect(payload.exclusions).toContain('internal audit logs');
});
