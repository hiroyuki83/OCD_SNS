import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSafeImageDimensions,
  readImageDimensions,
} from '../src/lib/imageDimensions';

test('reads PNG dimensions', () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, 1920, false);
  view.setUint32(20, 1080, false);
  assert.deepEqual(readImageDimensions(bytes, 'image/png'), { width: 1920, height: 1080 });
});

test('reads GIF dimensions', () => {
  const bytes = new Uint8Array([0x47,0x49,0x46,0x38,0x39,0x61,0x20,0x03,0x58,0x02]);
  assert.deepEqual(readImageDimensions(bytes, 'image/gif'), { width: 800, height: 600 });
});

test('reads JPEG SOF dimensions', () => {
  const bytes = new Uint8Array([
    0xff,0xd8,
    0xff,0xe0,0x00,0x04,0x00,0x00,
    0xff,0xc0,0x00,0x11,0x08,0x04,0x38,0x07,0x80,
    0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00,
    0xff,0xd9,
  ]);
  assert.deepEqual(readImageDimensions(bytes, 'image/jpeg'), { width: 1920, height: 1080 });
});

test('reads WebP VP8X dimensions', () => {
  const bytes = new Uint8Array(30);
  bytes.set([0x52,0x49,0x46,0x46], 0);
  bytes.set([0x57,0x45,0x42,0x50], 8);
  bytes.set([0x56,0x50,0x38,0x58], 12);
  const widthMinusOne = 1023;
  const heightMinusOne = 767;
  bytes[24] = widthMinusOne & 0xff;
  bytes[25] = (widthMinusOne >> 8) & 0xff;
  bytes[26] = (widthMinusOne >> 16) & 0xff;
  bytes[27] = heightMinusOne & 0xff;
  bytes[28] = (heightMinusOne >> 8) & 0xff;
  bytes[29] = (heightMinusOne >> 16) & 0xff;
  assert.deepEqual(readImageDimensions(bytes, 'image/webp'), { width: 1024, height: 768 });
});

test('rejects zero or malformed dimensions', () => {
  assert.equal(readImageDimensions(new Uint8Array(24), 'image/png'), null);
  assert.equal(readImageDimensions(new Uint8Array([0xff,0xd8,0xff,0xda]), 'image/jpeg'), null);
});


test('rejects malformed PNG without IHDR', () => {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 640, false);
  view.setUint32(20, 480, false);
  assert.equal(readImageDimensions(bytes, 'image/png'), null);
});

test('image dimension safety limits reject huge pixel counts and dimensions', () => {
  assert.equal(isSafeImageDimensions({ width: 8000, height: 6000 }), true);
  assert.equal(isSafeImageDimensions({ width: 12000, height: 4000 }), true);
  assert.equal(isSafeImageDimensions({ width: 12001, height: 1 }), false);
  assert.equal(isSafeImageDimensions({ width: 10000, height: 6000 }), false);
  assert.equal(isSafeImageDimensions({ width: 0, height: 100 }), false);
});
