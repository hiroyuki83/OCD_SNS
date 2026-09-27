import 'server-only';

import crypto from 'crypto';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 12000;
const MAX_IMAGE_PIXELS = 50_000_000;

type SupportedImage = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  extension: 'jpg' | 'png' | 'webp' | 'gif';
};

type ImageDimensions = {
  width: number;
  height: number;
};

function detectImageType(bytes: Uint8Array): SupportedImage | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: 'image/png', extension: 'png' };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }

  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') {
      return { mime: 'image/gif', extension: 'gif' };
    }
  }

  return null;
}

function readUInt24LE(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 >= bytes.length) return null;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readGifDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 10) return null;
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === 'VP8X') {
    const rawWidth = readUInt24LE(bytes, 24);
    const rawHeight = readUInt24LE(bytes, 27);
    if (rawWidth === null || rawHeight === null) return null;
    return { width: rawWidth + 1, height: rawHeight + 1 };
  }

  if (chunk === 'VP8L') {
    if (
      bytes.length < 25 ||
      bytes[20] !== 0x2f
    ) {
      return null;
    }
    const b1 = bytes[21];
    const b2 = bytes[22];
    const b3 = bytes[23];
    const b4 = bytes[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (chunk === 'VP8 ') {
    for (let offset = 20; offset + 9 < bytes.length; offset += 1) {
      if (
        bytes[offset + 3] === 0x9d &&
        bytes[offset + 4] === 0x01 &&
        bytes[offset + 5] === 0x2a
      ) {
        const width = (bytes[offset + 6] | (bytes[offset + 7] << 8)) & 0x3fff;
        const height = (bytes[offset + 8] | (bytes[offset + 9] << 8)) & 0x3fff;
        return width > 0 && height > 0 ? { width, height } : null;
      }
    }
  }

  return null;
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const sofMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf,
  ]);

  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) break;
    if (offset + 1 >= bytes.length) break;

    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;

    if (sofMarkers.has(marker)) {
      if (length < 7 || offset + 6 >= bytes.length) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += length;
  }

  return null;
}

export function readImageDimensions(
  bytes: Uint8Array,
  mime: SupportedImage['mime'],
): ImageDimensions | null {
  if (mime === 'image/png') return readPngDimensions(bytes);
  if (mime === 'image/gif') return readGifDimensions(bytes);
  if (mime === 'image/webp') return readWebpDimensions(bytes);
  return readJpegDimensions(bytes);
}

export async function validateImageUpload(file: File) {
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return { ok: false as const, error: '画像は5MB以下にしてください。' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);

  if (!detected || detected.mime !== file.type) {
    return {
      ok: false as const,
      error: '画像ファイルの形式を確認してください。JPEG、PNG、WebP、GIFのみ使用できます。',
    };
  }

  const dimensions = readImageDimensions(bytes, detected.mime);
  if (!dimensions) {
    return {
      ok: false as const,
      error: '画像の幅と高さを確認できませんでした。別の画像をお試しください。',
    };
  }

  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    return {
      ok: false as const,
      error: '画像の解像度が大きすぎます。最大12000px・5000万画素以内にしてください。',
    };
  }

  return {
    ok: true as const,
    extension: detected.extension,
    objectName: `${crypto.randomUUID()}.${detected.extension}`,
    width: dimensions.width,
    height: dimensions.height,
  };
}
