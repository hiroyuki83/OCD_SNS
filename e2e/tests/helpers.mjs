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
