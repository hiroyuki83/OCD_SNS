import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId : '';
    const action = body?.action === 'unfollow' ? 'unfollow' : 'follow';
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
    if (!rateLimit(`follow-action:${userId}`, 60, 60 * 1000)) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    if (action === 'unfollow') {
        await prisma.follow.deleteMany({
            where: { followerId: userId, followingId: targetUserId },
        });
        await prisma.notification.deleteMany({
            where: { type: 'FOLLOW', userId: targetUserId, actorId: userId },
        });
        return NextResponse.json({ ok: true });
    }

    await prisma.follow.upsert({
        where: {
            followerId_followingId: {
                followerId: userId,
                followingId: targetUserId,
            },
        },
        update: {},
        create: {
            followerId: userId,
            followingId: targetUserId,
        },
    });
    if (userId !== targetUserId) {
        await prisma.notification.create({
            data: {
                type: 'FOLLOW',
                userId: targetUserId,
                actorId: userId,
            },
        });
    }

    return NextResponse.json({ ok: true });
}
