import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { mutateMuteRelation } from '@/lib/userPrivacyRelations';
import { parseJsonMutationRequest } from '@/lib/requestSecurity';

const MUTE_ACTIONS = ['mute', 'unmute'] as const;
type MuteAction = (typeof MUTE_ACTIONS)[number];

export async function POST(request: Request) {
    const parsedRequest = await parseJsonMutationRequest<Record<string, unknown>>(request);
    if (!parsedRequest.ok) {
        return NextResponse.json({ ok: false, error: parsedRequest.error }, { status: parsedRequest.status });
    }

    const body = parsedRequest.data;
    const targetUserId = typeof body?.targetUserId === 'string' ? body.targetUserId.trim() : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    if (!targetUserId || targetUserId.length > 128 || !MUTE_ACTIONS.includes(action as MuteAction)) {
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

    if (!(await rateLimit(`mute-action:${userId}`, 60, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    const result = await mutateMuteRelation(userId, targetUserId, action as MuteAction);
    if (!result.ok) {
        return NextResponse.json(
            { ok: false },
            {
                status:
                    result.reason === 'NOT_FOUND'
                        ? 404
                        : result.reason === 'CONFLICT'
                          ? 409
                          : 400,
            },
        );
    }

    return NextResponse.json({ ok: true, active: result.active });
}
