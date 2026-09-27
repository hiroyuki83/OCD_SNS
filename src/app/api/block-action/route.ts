import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';

const BLOCK_ACTIONS = ['block', 'unblock'] as const;
type BlockAction = (typeof BLOCK_ACTIONS)[number];

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!targetUserId || targetUserId.length > 128 || !BLOCK_ACTIONS.includes(action as BlockAction)) {
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
        return NextResponse.json({ ok: false, error: '自分自身はブロックできません。' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!targetUser) {
        return NextResponse.json({ ok: false }, { status: 404 });
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

    await prisma.$transaction([
        prisma.block.upsert({
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
        }),
        prisma.follow.deleteMany({
            where: {
                OR: [
                    { followerId: userId, followingId: targetUserId },
                    { followerId: targetUserId, followingId: userId },
                ],
            },
        }),
        prisma.notification.deleteMany({
            where: {
                OR: [
                    { userId: targetUserId, actorId: userId },
                    { userId, actorId: targetUserId },
                ],
            },
        }),
    ]);

    return NextResponse.json({ ok: true });
}
