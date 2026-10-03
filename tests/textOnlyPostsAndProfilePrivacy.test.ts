import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('post composer is text-only', () => {
  const form = readFileSync('src/components/feed/CreatePostForm.tsx', 'utf8');
  const actions = readFileSync('src/app/lib/actions.ts', 'utf8');

  assert.ok(!form.includes('name="image"'));
  assert.ok(!form.includes('画像を追加'));
  assert.ok(!form.includes('imageAlt'));
  assert.ok(actions.includes("画像付き投稿には対応していません。"));
  assert.ok(actions.includes('imageUrl: null'));
  assert.ok(actions.includes('imageAlt: null'));
});

test('post images are not exposed in feed, search, profile, or post detail surfaces', () => {
  for (const path of [
    'src/app/api/feed/route.ts',
    'src/app/api/post/route.ts',
    'src/app/api/search-posts/route.ts',
    'src/app/api/user-handle/route.ts',
    'src/components/feed/Feed.tsx',
    'src/components/explore/ExploreClient.tsx',
    'src/components/profile/UserHandleClient.tsx',
    'src/app/post/[id]/page.tsx',
    'src/app/profile/page.tsx',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.equal(source.includes('post.imageUrl'), false, path);
    assert.equal(source.includes('post.imageAlt'), false, path);
  }
});

test('other users do not receive or render follow counts', () => {
  const route = readFileSync('src/app/api/user-handle/route.ts', 'utf8');
  const client = readFileSync('src/components/profile/UserHandleClient.tsx', 'utf8');

  assert.ok(route.includes('const isSelf = viewerId === user.id;'));
  assert.ok(route.includes('isSelf && !isBlockRestricted'));
  assert.ok(client.includes('viewerId === user.id'));
  assert.ok(client.includes("typeof user.followingCount === 'number'"));
  assert.ok(client.includes("typeof user.followerCount === 'number'"));
});
