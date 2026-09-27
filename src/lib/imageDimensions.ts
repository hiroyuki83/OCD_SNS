export type SupportedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

export type ImageDimensions = {
  width: number;
  height: number;
};

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
  if (bytes.length < 25) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));

  if (chunk === 'VP8X') {
    if (bytes.length < 30) return null;
    const rawWidth = readUInt24LE(bytes, 24);
    const rawHeight = readUInt24LE(bytes, 27);
    if (rawWidth === null || rawHeight === null) return null;
    return { width: rawWidth + 1, height: rawHeight + 1 };
  }

  if (chunk === 'VP8L') {
    if (bytes[20] !== 0x2f) return null;
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
  mime: SupportedImageMime,
): ImageDimensions | null {
  if (mime === 'image/png') return readPngDimensions(bytes);
  if (mime === 'image/gif') return readGifDimensions(bytes);
  if (mime === 'image/webp') return readWebpDimensions(bytes);
  return readJpegDimensions(bytes);
}
