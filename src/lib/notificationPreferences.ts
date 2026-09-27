export type NotificationPreferences = {
  notifyLikes: boolean;
  notifyReactions: boolean;
  notifyFollows: boolean;
};

export function parseNotificationPreferences(formData: FormData): NotificationPreferences {
  return {
    notifyLikes: formData.get('notifyLikes') === 'on',
    notifyReactions: formData.get('notifyReactions') === 'on',
    notifyFollows: formData.get('notifyFollows') === 'on',
  };
}
