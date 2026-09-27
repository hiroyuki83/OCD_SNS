import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const postInteractions = readFileSync(
  join(process.cwd(), 'src', 'lib', 'postInteractions.ts'),
  'utf8',
);
const userRelations = readFileSync(
  join(process.cwd(), 'src', 'lib', 'userRelations.ts'),
  'utf8',
);

test('like notifications require the author like preference', () => {
  assert.match(postInteractions, /authorId !== userId && notifyLikes/);
  assert.match(postInteractions, /notifyLikes: true/);
});

test('reaction notifications require the author reaction preference', () => {
  assert.match(postInteractions, /authorId !== userId && notifyReactions/);
  assert.match(postInteractions, /notifyReactions: true/);
});

test('follow notifications require the target follow preference', () => {
  assert.match(userRelations, /created && target\.notifyFollows/);
  assert.match(userRelations, /notifyFollows: true/);
});
