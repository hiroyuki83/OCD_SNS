import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { validateJsonMutationRequest } from '@/lib/requestSecurity';

export async function POST(request: Request) {
    const requestCheck = validateJsonMutationRequest(request);
    if (!requestCheck.ok) {
        return NextResponse.json({ ok: false, error: requestCheck.error }, { status: requestCheck.status });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
    const action = body?.action === 'unmute' ? 'unmute' : 'mute';
    if (!targetUserId) {
        return NextResponse.json({ ok: false }, { status: 400 });
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
    if (!userId || userId === targetUserId) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetUser) {
        return NextResponse.json({ ok: false }, { status: 404 });
    }
    if (!(await rateLimit(`mute-action:${userId}`, 60, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    if (action === 'unmute') {
        await prisma.mute.deleteMany({
            where: { muterId: userId, mutedId: targetUserId },
        });
        return NextResponse.json({ ok: true });
    }

    await prisma.mute.upsert({
        where: {
            muterId_mutedId: {
                muterId: userId,
                mutedId: targetUserId,
            },
        },
        update: {},
        create: {
            muterId: userId,
            mutedId: targetUserId,
        },
    });

    return NextResponse.json({ ok: true });
}
