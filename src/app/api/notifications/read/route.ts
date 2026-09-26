import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { validateJsonMutationRequest } from '@/lib/requestSecurity';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
    const requestCheck = validateJsonMutationRequest(request);
    if (!requestCheck.ok) {
        return NextResponse.json({ ok: false, error: requestCheck.error }, { status: requestCheck.status });
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
    await Promise.all([
        prisma.notification.updateMany({
            where: { userId, readAt: null },
            data: { readAt },
        }),
        prisma.moderationWarning.updateMany({
            where: { targetUserId: userId, readAt: null },
            data: { readAt },
        }),
    ]);

    return NextResponse.json({ ok: true });
}
