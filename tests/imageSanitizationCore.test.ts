import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';

import { sanitizeImageMetadata } from '../src/lib/imageSanitizationCore';

const PRIVATE_XMP = `<?xml version="1.0"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:creator><rdf:Seq><rdf:li>Private Person</rdf:li></rdf:Seq></dc:creator>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;

async function privateJpeg() {
  return sharp({
    create: {
      width: 2,
      height: 1,
      channels: 3,
      background: { r: 240, g: 20, b: 20 },
    },
  })
    .jpeg({ quality: 95 })
    .withExif({
      IFD0: {
        Copyright: 'Private Copyright',
      },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '33/1 35/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '130/1 24/1 0/1',
      },
    })
    .withXmp(PRIVATE_XMP)
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

test('JPEG sanitization strips private metadata and applies EXIF orientation', async () => {
  const input = await privateJpeg();
  const before = await sharp(input).metadata();

  assert.equal(before.width, 2);
  assert.equal(before.height, 1);
  assert.equal(before.orientation, 6);
  assert.ok(before.exif, 'fixture must contain EXIF metadata');
  assert.ok(before.xmp, 'fixture must contain XMP metadata');

  const sanitized = await sanitizeImageMetadata(
    new Uint8Array(input),
    'image/jpeg',
  );
  const after = await sharp(sanitized.data).metadata();

  assert.equal(sanitized.format, 'jpeg');
  assert.equal(sanitized.width, 1);
  assert.equal(sanitized.height, 2);
  assert.equal(after.width, 1);
  assert.equal(after.height, 2);

  assert.equal(after.orientation, undefined);
  assert.equal(after.exif, undefined);
  assert.equal(after.xmp, undefined);
  assert.equal(after.iptc, undefined);
  assert.equal(after.icc, undefined);
  assert.equal(after.hasProfile, false);
});

test('sanitized JPEG remains decodable with the expected format', async () => {
  const input = await privateJpeg();
  const sanitized = await sanitizeImageMetadata(
    new Uint8Array(input),
    'image/jpeg',
  );

  const decoded = await sharp(sanitized.data).raw().toBuffer({
    resolveWithObject: true,
  });

  assert.equal(decoded.info.width, 1);
  assert.equal(decoded.info.height, 2);
  assert.equal(decoded.info.channels >= 3, true);
  assert.equal(sanitized.data.byteLength > 0, true);
});
