import sharp from 'sharp';

import {
  MAX_SAFE_IMAGE_PIXELS,
  type SupportedImageMime,
} from './imageDimensions';

export type SanitizedImage = {
  data: Uint8Array;
  format: 'jpeg' | 'png' | 'webp' | 'gif';
  width: number;
  height: number;
  pages: number;
};

function expectedFormat(mime: SupportedImageMime): SanitizedImage['format'] {
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'gif';
}

export async function sanitizeImageMetadata(
  bytes: Uint8Array,
  mime: SupportedImageMime,
): Promise<SanitizedImage> {
  const animated = mime === 'image/gif' || mime === 'image/webp';

  const metadata = await sharp(bytes, {
    animated,
    failOn: 'warning',
    limitInputPixels: MAX_SAFE_IMAGE_PIXELS,
  }).metadata();

  const width = metadata.width ?? 0;
  const pageHeight = metadata.pageHeight ?? metadata.height ?? 0;
  const pages = metadata.pages ?? 1;

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(pageHeight) ||
    !Number.isSafeInteger(pages) ||
    width <= 0 ||
    pageHeight <= 0 ||
    pages <= 0 ||
    width * pageHeight * pages > MAX_SAFE_IMAGE_PIXELS
  ) {
    throw new Error('Image decode dimensions exceed the safe pixel budget.');
  }

  let pipeline = sharp(bytes, {
    animated,
    failOn: 'warning',
    limitInputPixels: MAX_SAFE_IMAGE_PIXELS,
  }).autoOrient();

  if (mime === 'image/jpeg') {
    pipeline = pipeline.jpeg({
      quality: 90,
      mozjpeg: true,
    });
  } else if (mime === 'image/png') {
    pipeline = pipeline.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    });
  } else if (mime === 'image/webp') {
    pipeline = pipeline.webp({
      quality: 90,
      alphaQuality: 100,
      effort: 4,
      smartSubsample: true,
      ...(metadata.loop !== undefined ? { loop: metadata.loop } : {}),
      ...(metadata.delay !== undefined ? { delay: metadata.delay } : {}),
    });
  } else {
    pipeline = pipeline.gif({
      effort: 7,
      reuse: true,
      ...(metadata.loop !== undefined ? { loop: metadata.loop } : {}),
      ...(metadata.delay !== undefined ? { delay: metadata.delay } : {}),
    });
  }

  // Sharp removes EXIF, XMP, IPTC and ICC metadata by default unless an
  // explicit keep*/with* metadata method is used. autoOrient() applies EXIF
  // Orientation to pixels before that metadata is discarded.
  const { data, info } = await pipeline.toUint8Array();

  const format = expectedFormat(mime);
  if (info.format !== format) {
    throw new Error('Sanitized image format changed unexpectedly.');
  }

  const outputPages = info.pages ?? 1;
  const outputPageHeight = info.pageHeight ?? info.height;
  if (
    !Number.isSafeInteger(info.width) ||
    !Number.isSafeInteger(outputPageHeight) ||
    !Number.isSafeInteger(outputPages) ||
    info.width <= 0 ||
    outputPageHeight <= 0 ||
    outputPages <= 0 ||
    info.width * outputPageHeight * outputPages > MAX_SAFE_IMAGE_PIXELS
  ) {
    throw new Error('Sanitized image exceeds the safe pixel budget.');
  }

  return {
    data,
    format,
    width: info.width,
    height: outputPageHeight,
    pages: outputPages,
  };
}
