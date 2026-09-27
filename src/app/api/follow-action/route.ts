import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';
import { mutateFollowRelation } from '@/lib/userRelations';

const FOLLOW_ACTIONS = ['follow', 'unfollow'] as const;
type FollowAction = (typeof FOLLOW_ACTIONS)[number];

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!targetUserId || targetUserId.length > 128 || !FOLLOW_ACTIONS.includes(action as FollowAction)) {
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
        return NextResponse.json({ ok: false, error: '自分自身はフォローできません。' }, { status: 400 });
    }

    if (!(await rateLimit(`follow-action:${userId}`, 60, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    const result = await mutateFollowRelation(
        userId,
        targetUserId,
        action as FollowAction,
    );
    if (!result.ok) {
        const status =
            result.reason === 'NOT_FOUND'
                ? 404
                : result.reason === 'BLOCKED'
                  ? 403
                  : 400;
        return NextResponse.json({ ok: false }, { status });
    }


    return NextResponse.json({
        ok: true,
        followState: result.state,
    });
}
