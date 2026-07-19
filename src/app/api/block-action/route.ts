import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
    const action = body?.action === 'unblock' ? 'unblock' : 'block';
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
    if (!(await rateLimit(`block-action:${userId}`, 60, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    if (action === 'unblock') {
        await prisma.block.deleteMany({
            where: { blockerId: userId, blockedId: targetUserId },
        });
        return NextResponse.json({ ok: true });
    }

    await prisma.block.upsert({
        where: {
            blockerId_blockedId: {
                blockerId: userId,
                blockedId: targetUserId,
            },
        },
        update: {},
        create: {
            blockerId: userId,
            blockedId: targetUserId,
        },
    });

    await prisma.follow.deleteMany({
        where: {
            OR: [
                { followerId: userId, followingId: targetUserId },
                { followerId: targetUserId, followingId: userId },
            ],
        },
    });

    return NextResponse.json({ ok: true });
}
