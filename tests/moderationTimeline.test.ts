import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModerationTimeline } from '../src/lib/moderationTimeline';

test('merges warnings reports sanctions and enforcement logs by newest first', () => {
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
    sanctions: [
      {
        id: 's1',
        createdAt: new Date('2026-09-27T11:00:00Z'),
        startsAt: new Date('2026-09-27T11:00:00Z'),
        endsAt: new Date('2026-09-28T11:00:00Z'),
        revokedAt: null,
        type: 'POST_RESTRICTION',
        status: 'ACTIVE',
        reason: 'safety',
      },
    ],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date('2026-09-27T12:00:00Z'),
        action: 'POST_HIDE',
        meta: { reason: 'safety', reportId: 'r1' },
      },
    ],
    now: new Date('2026-09-27T13:00:00Z'),
  });

  assert.deepEqual(timeline.map((item) => item.id), [
    'audit-a1',
    'sanction-s1',
    'warning-w1',
    'report-r1',
  ]);
  assert.equal(timeline.find((item) => item.id === 'sanction-s1')?.title, '投稿制限');
});

test('recognizes the actual USER_STATUS_CHANGE audit action', () => {
  const [item] = buildModerationTimeline({
    warnings: [],
    reports: [],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date(),
        action: 'USER_STATUS_CHANGE',
        meta: { reason: 'rule', reportId: 'r1' },
      },
    ],
  });
  assert.equal(item.id, 'audit-a1');
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

test('treats an active sanction past its end time as expired for display', () => {
  const [item] = buildModerationTimeline({
    warnings: [],
    reports: [],
    sanctions: [
      {
        id: 's1',
        createdAt: new Date('2026-09-27T10:00:00Z'),
        startsAt: new Date('2026-09-27T10:00:00Z'),
        endsAt: new Date('2026-09-27T11:00:00Z'),
        revokedAt: null,
        type: 'SUSPENSION',
        status: 'ACTIVE',
        reason: 'rule',
      },
    ],
    auditLogs: [],
    now: new Date('2026-09-27T12:00:00Z'),
  });
  assert.equal(item.title, 'アカウント停止');
  assert.equal(item.status, 'EXPIRED');
});

test('summarizes only selected enforcement metadata fields', () => {
  const [item] = buildModerationTimeline({
    warnings: [],
    reports: [],
    auditLogs: [
      {
        id: 'a1',
        createdAt: new Date(),
        action: 'USER_STATUS_CHANGE',
        meta: { reason: 'rule', password: 'must-not-render', reportId: 'r1' },
      },
    ],
  });
  assert.equal(item.detail, 'reason: rule / reportId: r1');
  assert.equal(item.detail?.includes('password'), false);
});


test('includes sanction appeal review audit events and outcome metadata', () => {
  const [item] = buildModerationTimeline({
    warnings: [],
    reports: [],
    auditLogs: [
      {
        id: 'appeal-review',
        createdAt: new Date(),
        action: 'SANCTION_APPEAL_REVIEWED',
        meta: { outcome: 'OVERTURNED', note: 'reviewed' },
      },
    ],
  });
  assert.equal(item.id, 'audit-appeal-review');
  assert.equal(item.detail, 'note: reviewed / outcome: OVERTURNED');
});
