import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';

export const PREVIEW_PASSWORD =
  process.env.PREVIEW_TEST_PASSWORD ?? 'PreviewPass123!';
export const USERS = {
  public1: 'coco.preview.public1@example.com',
  public2: 'coco.preview.public2@example.com',
  private: 'coco.preview.private@example.com',
  moderator: 'coco.preview.moderator@example.com',
  admin: 'coco.preview.admin@example.com',
};

export async function login(page, email, password = PREVIEW_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function verificationUrlFor(email) {
  const path = process.env.E2E_EMAIL_OUTBOX_FILE;
  if (!path) throw new Error('E2E_EMAIL_OUTBOX_FILE is not set.');

  let found = null;
  await expect
    .poll(
      async () => {
        try {
          const text = await readFile(path, 'utf8');
          const messages = text
            .trim()
            .split('\n')
            .filter(Boolean)
            .map((line) => JSON.parse(line));
          const message = [...messages].reverse().find((item) => item.to === email);
          if (!message) return null;
          const match = message.text.match(/https?:\/\/[^\s]+\/verify-email\?token=[^\s]+/);
          found = match?.[0] ?? null;
          return found;
        } catch {
          return null;
        }
      },
      { timeout: 10_000 },
    )
    .not.toBeNull();

  return found;
}
