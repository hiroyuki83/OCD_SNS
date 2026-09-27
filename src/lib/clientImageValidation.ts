import {
  isSafeImageDimensions,
  readImageDimensions,
  type SupportedImageMime,
} from '@/lib/imageDimensions';

const MAX_CLIENT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_CLIENT_IMAGE_TYPES = new Set<SupportedImageMime>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function validateClientImageFile(file: File) {
  if (!SUPPORTED_CLIENT_IMAGE_TYPES.has(file.type as SupportedImageMime)) {
    return 'JPEG、PNG、WebP、GIF画像を選択してください。';
  }
  if (file.size <= 0) {
    return '空の画像ファイルは使用できません。';
  }
  if (file.size > MAX_CLIENT_IMAGE_SIZE_BYTES) {
    return '画像は5MB以下にしてください。';
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = readImageDimensions(bytes, file.type as SupportedImageMime);
    if (!dimensions) {
      return '画像の幅と高さを確認できませんでした。別の画像をお試しください。';
    }
    if (!isSafeImageDimensions(dimensions)) {
      return '画像の解像度が大きすぎます。最大12000px・5000万画素以内にしてください。';
    }
  } catch {
    return '画像を確認できませんでした。別の画像をお試しください。';
  }

  return null;
}
