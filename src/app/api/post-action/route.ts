import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { AccountStatus } from '@prisma/client';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';
import { togglePostInteraction } from '@/lib/postInteractions';

type ActionType = 'like' | 'wakaru' | 'ganbatta' | 'bookmark';
const ACTION_TYPES = ['like', 'wakaru', 'ganbatta', 'bookmark'] as const;

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const postId = typeof body?.postId === 'string' ? body.postId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!postId || postId.length > 128 || !ACTION_TYPES.includes(action as ActionType)) {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    const actionType = action as ActionType;

    const session = await auth();
    let userId = session?.user?.id ?? null;
    let userStatus: AccountStatus | null = null;
    let suspendedUntil: Date | null = null;
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { status: true, suspendedUntil: true },
        });
        userStatus = user?.status ?? null;
        suspendedUntil = user?.suspendedUntil ?? null;
    }
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, status: true, suspendedUntil: true },
        });
        userId = user?.id ?? null;
        userStatus = user?.status ?? null;
        suspendedUntil = user?.suspendedUntil ?? null;
    }
    if (!userId) {
        return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (userStatus === AccountStatus.SUSPENDED) {
        if (!suspendedUntil || suspendedUntil > new Date()) {
            return NextResponse.json({ ok: false }, { status: 403 });
        }
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: AccountStatus.ACTIVE,
                suspendedUntil: null,
                restrictionUntil: null,
                restrictionReason: null,
            },
        });
    }
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    const result = await togglePostInteraction(userId, postId, actionType);
    if (!result.ok) {
        return NextResponse.json(
            { ok: false },
            { status: result.reason === 'NOT_FOUND' ? 404 : 409 },
        );
    }

    return NextResponse.json({
        ok: true,
        active: result.active,
        count: result.count,
    });
}
