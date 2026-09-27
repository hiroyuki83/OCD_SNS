import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModerationTimeline } from '../src/lib/moderationTimeline';

test('merges warnings reports and enforcement logs by newest first', () => {
  const timeline = buildModerationTimeline({
    warnings: [
      {
        id: 'w1',
        createdAt: new Date('2026-09-27T10:00:00Z'),
        revokedAt: null,
        reason: 'warning reason',
      },
    ],
    reports: [
      {
        id: 'r1',
        createdAt: new Date('2026-09-27T09:00:00Z'),
        reason: 'SPAM',
        status: 'OPEN',
        detail: 'report detail',
      },
    ],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date('2026-09-27T11:00:00Z'),
        action: 'USER_SUSPENDED',
        meta: { reason: 'safety', duration: '7d' },
      },
    ],
  });

  assert.deepEqual(timeline.map((item) => item.id), ['audit-a1', 'warning-w1', 'report-r1']);
});

test('ignores unrelated audit actions', () => {
  const timeline = buildModerationTimeline({
    warnings: [],
    reports: [],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date(),
        action: 'PROFILE_UPDATED',
        meta: {},
      },
    ],
  });
  assert.deepEqual(timeline, []);
});

test('marks revoked warnings explicitly', () => {
  const [item] = buildModerationTimeline({
    warnings: [
      {
        id: 'w1',
        createdAt: new Date(),
        revokedAt: new Date(),
        reason: 'warning reason',
      },
    ],
    reports: [],
    auditLogs: [],
  });
  assert.equal(item.title, '警告（取消済み）');
  assert.equal(item.status, 'REVOKED');
});

test('summarizes only selected enforcement metadata fields', () => {
  const [item] = buildModerationTimeline({
    warnings: [],
    reports: [],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date(),
        action: 'USER_STATUS_CHANGED',
        meta: { reason: 'rule', password: 'must-not-render', reportId: 'r1' },
      },
    ],
  });
  assert.equal(item.detail, 'reason: rule / reportId: r1');
  assert.equal(item.detail?.includes('password'), false);
});
