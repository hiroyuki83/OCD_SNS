import 'server-only';

import crypto from 'crypto';
import {
  isSafeImageDimensions,
  readImageDimensions,
} from '@/lib/imageDimensions';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type SupportedImage = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  extension: 'jpg' | 'png' | 'webp' | 'gif';
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

  if (!isSafeImageDimensions(dimensions)) {
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
