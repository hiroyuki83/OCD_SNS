import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'src', 'app', 'moderation', 'appeals', 'actions.ts'),
  'utf8',
);

test('appeal review makes the warning unread again for both outcomes', () => {
  const matches = source.match(/readAt: null/g) ?? [];
  assert.ok(matches.length >= 2);
  assert.match(source, /WarningAppealStatus\.UPHELD/);
  assert.match(source, /WarningAppealStatus\.OVERTURNED/);
});

test('appeal review revalidates notifications after persistence', () => {
  assert.match(source, /revalidatePath\('\/notifications'\)/);
});
