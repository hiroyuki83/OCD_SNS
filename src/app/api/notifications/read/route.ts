import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';
import { rateLimit } from '@/lib/rateLimit';
import { parseUniqueStringIds } from '@/lib/idList';

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const parsedNotificationIds = parseUniqueStringIds(body.notificationIds ?? [], 50);
    const parsedWarningIds = parseUniqueStringIds(body.warningIds ?? [], 50);
    if (!parsedNotificationIds.ok || !parsedWarningIds.ok) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    const notificationIds = parsedNotificationIds.value;
    const warningIds = parsedWarningIds.value;
    if (notificationIds.length === 0 && warningIds.length === 0) {
        return NextResponse.json({ ok: true, updated: 0 });
    }

    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }
    if (!userId) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!(await rateLimit(`notifications-read:${userId}`, 60, 60 * 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    const readAt = new Date();
    const [social, warnings] = await Promise.all([
        notificationIds.length > 0
            ? prisma.notification.updateMany({
                  where: {
                      id: { in: notificationIds },
                      userId,
                      readAt: null,
                  },
                  data: { readAt },
              })
            : Promise.resolve({ count: 0 }),
        warningIds.length > 0
            ? prisma.moderationWarning.updateMany({
                  where: {
                      id: { in: warningIds },
                      targetUserId: userId,
                      readAt: null,
                  },
                  data: { readAt },
              })
            : Promise.resolve({ count: 0 }),
    ]);

    return NextResponse.json({ ok: true, updated: social.count + warnings.count });
}
