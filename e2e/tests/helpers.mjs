import { readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import { expect } from '@playwright/test';

export const PREVIEW_PASSWORD =
  process.env.PREVIEW_TEST_PASSWORD ?? 'PreviewPass123!';
export const USERS = {
  public1: 'coco.preview.public1@example.com',
  public2: 'coco.preview.public2@example.com',
  private: 'coco.preview.private@example.com',
  moderator: 'coco.preview.moderator@example.com',
  admin: 'coco.preview.admin@example.com',
  moderator2: 'coco.preview.moderator2@example.com',
  admin2: 'coco.preview.admin2@example.com',
  admin3: 'coco.preview.admin3@example.com',
};

export async function login(page, email, password = PREVIEW_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.locator('#main-content').getByRole('button', { name: 'ログイン', exact: true }).click();
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


const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(input) {
  const normalized = input.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value < 0) throw new Error('Invalid base32 secret');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpCode(secret, stepOffset = 0) {
  const step = Math.floor(Date.now() / 1000 / 30) + stepOffset;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}


export async function enrollStaffMfa(page, email, password = PREVIEW_PASSWORD) {
  await login(page, email, password);
  await page.goto('/settings?mfa=required');

  const section = page.locator('section').filter({
    has: page.getByRole('heading', { name: 'スタッフ2段階認証' }),
  });

  const alreadyEnabled = await section.getByText('有効', { exact: true }).count();
  if (alreadyEnabled > 0) {
    return { secret: null, recoveryCodes: [] };
  }

  await section.getByLabel('現在のパスワード').first().fill(password);
  await section.getByRole('button', { name: '2段階認証の登録を開始' }).click();

  await expect(section.getByText('秘密鍵')).toBeVisible();
  const secret = (await section.locator('code').first().textContent())?.trim() ?? '';
  expect(secret.length).toBeGreaterThan(10);

  const enableButton = section.getByRole('button', { name: 'コードを確認して有効化' });
  const enrollment = enableButton.locator('xpath=ancestor::form');
  await enrollment.getByLabel('現在のパスワード').fill(password);
  await enrollment.getByLabel('6桁コード').fill(totpCode(secret));
  await enableButton.click();

  await expect(section.getByText('リカバリーコードを保存してください')).toBeVisible();
  const recoveryCodes = (await section.locator('code').allTextContents())
    .map((value) => value.trim())
    .filter((value) => value.length >= 10 && value !== secret);

  return { secret, recoveryCodes };
}

export async function loginStaffWithTotp(page, email, secret, password = PREVIEW_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード').fill(password);
  await page.getByLabel('6桁コード').fill(totpCode(secret));
  await page.locator('#main-content').getByRole('button', { name: 'ログイン', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}



export async function reportVisiblePost(page, postContent, {
  reasonNumber = '1',
  detail = 'E2E report detail',
} = {}) {
  await page.goto(`/explore?q=${encodeURIComponent(postContent)}`);
  const result = page.getByText(postContent, { exact: true });
  await expect(result).toBeVisible();
  const resultCard = result.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  await resultCard.getByRole('link', { name: '投稿を開く' }).click();

  let promptIndex = 0;
  page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
      const value = promptIndex === 0 ? reasonNumber : detail;
      promptIndex += 1;
      await dialog.accept(value);
      return;
    }
    await dialog.accept();
  });

  await page.getByRole('button', { name: '通報', exact: true }).click();
  await expect.poll(() => promptIndex).toBeGreaterThanOrEqual(2);
}
