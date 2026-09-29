import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('handle profile API preserves post image alt text end-to-end', () => {
  const route = readFileSync('src/app/api/user-handle/route.ts', 'utf8');
  const client = readFileSync('src/components/profile/UserHandleClient.tsx', 'utf8');

  assert.match(route, /imageUrl:\s*true,\s*imageAlt:\s*true,/);
  assert.match(route, /imageUrl:\s*post\.imageUrl,\s*imageAlt:\s*post\.imageAlt,/);
  assert.match(client, /imageAlt:\s*string \| null/);
  assert.match(client, /alt=\{post\.imageAlt \?\? ''\}/);
});
