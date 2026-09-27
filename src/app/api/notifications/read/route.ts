import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const notificationIds = Array.isArray(body.notificationIds)
        ? body.notificationIds.filter(
              (value): value is string =>
                  typeof value === 'string' && value.length > 0 && value.length <= 128,
          )
        : [];
    const warningIds = Array.isArray(body.warningIds)
        ? body.warningIds.filter(
              (value): value is string =>
                  typeof value === 'string' && value.length > 0 && value.length <= 128,
          )
        : [];
    if (
        notificationIds.length > 50 ||
        warningIds.length > 50 ||
        notificationIds.length !== new Set(notificationIds).size ||
        warningIds.length !== new Set(warningIds).size
    ) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
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
