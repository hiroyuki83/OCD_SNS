'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { parseNotificationPreferences } from '@/lib/notificationPreferences';

export type NotificationPreferenceState =
  | { ok?: boolean; message?: string }
  | undefined;

export async function updateNotificationPreferences(
  _prevState: NotificationPreferenceState,
  formData: FormData,
): Promise<NotificationPreferenceState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { message: 'ログインしてください。' };

  if (!(await rateLimit(`notification-preferences:${userId}`, 20, 60 * 60 * 1000))) {
    return { message: '操作が多すぎます。しばらくしてから再度お試しください。' };
  }

  const preferences = parseNotificationPreferences(formData);
  const updated = await prisma.user.updateMany({
    where: { id: userId },
    data: preferences,
  });
  if (updated.count !== 1) {
    return { message: '通知設定を更新できませんでした。' };
  }

  revalidatePath('/settings');
  revalidatePath('/notifications');
  return { ok: true, message: '通知設定を保存しました。' };
}
