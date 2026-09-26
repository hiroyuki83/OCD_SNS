import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { validateJsonMutationRequest } from '@/lib/requestSecurity';

const MUTE_ACTIONS = ['mute', 'unmute'] as const;
type MuteAction = (typeof MUTE_ACTIONS)[number];

export async function POST(request: Request) {
    const requestCheck = validateJsonMutationRequest(request);
    if (!requestCheck.ok) {
        return NextResponse.json({ ok: false, error: requestCheck.error }, { status: requestCheck.status });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!targetUserId || !MUTE_ACTIONS.includes(action as MuteAction)) {
        return NextResponse.json({ ok: false, error: '不正な操作です。' }, { status: 400 });
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
    if (userId === targetUserId) {
        return NextResponse.json({ ok: false, error: '自分自身はミュートできません。' }, { status: 400 });
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
