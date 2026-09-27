import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeUserSearchTerm, searchableUserWhere } from '../src/lib/searchUsers';

test('removes one leading @ from user search terms', () => {
  assert.equal(normalizeUserSearchTerm('@coco'), 'coco');
  assert.equal(normalizeUserSearchTerm('coco'), 'coco');
});

test('user search does not add email to searchable fields', () => {
  const where = JSON.stringify(searchableUserWhere('viewer-1', '@coco', new Date('2026-09-28T00:00:00Z')));
  assert.equal(where.includes('email'), false);
  assert.equal(where.includes('handle'), true);
  assert.equal(where.includes('name'), true);
  assert.equal(where.includes('bio'), true);
});

test('authenticated user search excludes block and mute relationships', () => {
  const where = JSON.stringify(searchableUserWhere('viewer-1', 'coco', new Date('2026-09-28T00:00:00Z')));
  assert.match(where, /blocksInitiated/);
  assert.match(where, /blockedBy/);
  assert.match(where, /mutedBy/);
});

test('guest user search does not depend on relationship rows', () => {
  const where = JSON.stringify(searchableUserWhere(null, 'coco', new Date('2026-09-28T00:00:00Z')));
  assert.equal(where.includes('blocksInitiated'), false);
  assert.equal(where.includes('blockedBy'), false);
  assert.equal(where.includes('mutedBy'), false);
});
