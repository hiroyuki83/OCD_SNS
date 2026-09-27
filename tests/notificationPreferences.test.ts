import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNotificationPreferences } from '../src/lib/notificationPreferences';

test('parses checked notification preferences', () => {
  const form = new FormData();
  form.set('notifyLikes', 'on');
  form.set('notifyFollows', 'on');
  assert.deepEqual(parseNotificationPreferences(form), {
    notifyLikes: true,
    notifyReactions: false,
    notifyFollows: true,
  });
});

test('treats missing notification preferences as disabled', () => {
  assert.deepEqual(parseNotificationPreferences(new FormData()), {
    notifyLikes: false,
    notifyReactions: false,
    notifyFollows: false,
  });
});
