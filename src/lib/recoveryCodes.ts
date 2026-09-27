import crypto from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RAW_LENGTH = 16;
const CODE_COUNT = 10;

export function generateStaffRecoveryCodes(count = CODE_COUNT) {
  const codes = new Set<string>();
  while (codes.size < count) {
    let raw = '';
    while (raw.length < RAW_LENGTH) {
      const byte = crypto.randomBytes(1)[0];
      const limit = 256 - (256 % ALPHABET.length);
      if (byte >= limit) continue;
      raw += ALPHABET[byte % ALPHABET.length];
    }
    codes.add(formatRecoveryCode(raw));
  }
  return [...codes];
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(value: string) {
  return crypto
    .createHash('sha256')
    .update(normalizeRecoveryCode(value), 'utf8')
    .digest('hex');
}

export function formatRecoveryCode(raw: string) {
  const normalized = normalizeRecoveryCode(raw);
  return normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
}
