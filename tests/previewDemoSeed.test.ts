import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('Preview seed creates a populated demo community', () => {
  const source = readFileSync('prisma/seed-preview.ts', 'utf8');

  assert.ok(source.includes("name: 'みさき'"));
  assert.ok(source.includes("name: 'はる'"));
  assert.ok(source.includes("avatarUrl: '/preview-demo/avatars/misaki.svg'"));
  assert.ok(source.includes('preview-demo-post-misaki-1'));
  assert.ok(source.includes('prisma.follow.createMany'));
  assert.ok(source.includes('prisma.like.createMany'));
  assert.ok(source.includes('prisma.reaction.createMany'));
  assert.ok(source.includes('prisma.notification.createMany'));
  assert.ok(source.includes('preview-demo-announcement-welcome'));
});

test('Preview demo visual assets are committed locally', () => {
  for (const path of [
    'public/preview-demo/avatars/misaki.svg',
    'public/preview-demo/avatars/haru.svg',
    'public/preview-demo/avatars/yuu.svg',
    'public/preview-demo/avatars/sakura.svg',
    'public/preview-demo/avatars/admin.svg',
    'public/preview-demo/avatars/moderator.svg',
    'public/preview-demo/headers/morning.svg',
    'public/preview-demo/headers/calm.svg',
  ]) {
    assert.equal(existsSync(path), true, `missing Preview demo asset: ${path}`);
  }
});


test('isolated E2E seed keeps the legacy fixture identity and skips demo relationships', () => {
  const source = readFileSync('prisma/seed-preview.ts', 'utf8');

  assert.ok(source.includes("const isIsolatedE2E = process.env.E2E_BLOB_MODE?.trim() === '1';"));
  assert.ok(source.includes("name: 'Preview 公開ユーザー1'"));
  assert.ok(source.includes("name: 'Preview 公開ユーザー2'"));
  assert.ok(source.includes("name: 'Preview Appeal User'"));
  assert.ok(source.includes("autoHashtag: isIsolatedE2E ? null : seed.autoHashtag"));
  assert.ok(source.includes("Seeded isolated E2E users without Preview demo community data."));
});
