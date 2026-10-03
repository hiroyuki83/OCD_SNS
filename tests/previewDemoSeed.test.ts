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
    'public/preview-demo/posts/walk.svg',
    'public/preview-demo/posts/sky.svg',
    'public/preview-demo/posts/desk.svg',
  ]) {
    assert.equal(existsSync(path), true, `missing Preview demo asset: ${path}`);
  }
});
