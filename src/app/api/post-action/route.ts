import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { AccountStatus } from '@prisma/client';
import { isSuspensionActive } from '@/lib/accountStatus';
import { getAccessiblePostForViewer } from '@/lib/postAccess';
import { validateJsonMutationRequest } from '@/lib/requestSecurity';

type ActionType = 'like' | 'wakaru' | 'ganbatta' | 'bookmark';
const ACTION_TYPES = ['like', 'wakaru', 'ganbatta', 'bookmark'] as const;

export async function POST(request: Request) {
    const requestCheck = validateJsonMutationRequest(request);
    if (!requestCheck.ok) {
        return NextResponse.json({ ok: false, error: requestCheck.error }, { status: requestCheck.status });
    }

    const body = await request.json().catch(() => ({}));
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
            data: { status: AccountStatus.ACTIVE, suspendedUntil: null, restrictionReason: null },
        });
    }
    if (!(await rateLimit(`post-action:${userId}`, 120, 60 * 1000))) {
        return NextResponse.json({ ok: false }, { status: 429 });
    }

    const visiblePost = await getAccessiblePostForViewer(userId, postId);
    if (!visiblePost) {
        return NextResponse.json({ ok: false }, { status: 404 });
    }

    if (actionType === 'like') {
        const removedLike = await prisma.like.deleteMany({
            where: { userId, postId },
        });
        if (removedLike.count > 0) {
            if (visiblePost.authorId) {
                await prisma.notification.deleteMany({
                    where: {
                        type: 'LIKE',
                        userId: visiblePost.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        } else {
            const createdLike = await prisma.like.createMany({
                data: [{ userId, postId }],
                skipDuplicates: true,
            });
            if (createdLike.count > 0 && visiblePost.authorId && visiblePost.authorId !== userId) {
                await prisma.notification.create({
                    data: {
                        type: 'LIKE',
                        userId: visiblePost.authorId,
                        actorId: userId,
                        postId,
                    },
                });
            }
        }
    }

    if (actionType === 'bookmark') {
        const existing = await prisma.bookmark.findUnique({
            where: { userId_postId: { userId, postId } },
        });
        if (existing) {
            await prisma.bookmark.delete({ where: { id: existing.id } });
        } else {
            await prisma.bookmark.create({ data: { userId, postId } });
        }
    }

    if (actionType === 'wakaru' || actionType === 'ganbatta') {
        const type = actionType === 'wakaru' ? 'WAKARU' : 'GANBATTA';
        await prisma.$transaction(async (tx) => {
            const existing = await tx.reaction.findUnique({
                where: { userId_postId_type: { userId, postId, type } },
            });
            const post = await tx.post.findUnique({
                where: { id: postId },
                select: { authorId: true, deletedAt: true, isHidden: true, author: { select: { status: true, suspendedUntil: true } } },
            });
            if (!post || post.deletedAt || post.isHidden || isSuspensionActive(post.author.status, post.author.suspendedUntil)) return;
            if (existing) {
                await tx.reaction.delete({ where: { id: existing.id } });
                await tx.post.update({
                    where: { id: postId },
                    data:
                        type === 'WAKARU'
                            ? { wakaruCount: { decrement: 1 } }
                            : { ganbattaCount: { decrement: 1 } },
                });
                if (post?.authorId) {
                    await tx.notification.deleteMany({
                        where: {
                            type,
                            userId: post.authorId,
                            actorId: userId,
                            postId,
                        },
                    });
                }
            } else {
                await tx.reaction.create({ data: { userId, postId, type } });
                await tx.post.update({
                    where: { id: postId },
                    data:
                        type === 'WAKARU'
                            ? { wakaruCount: { increment: 1 } }
                            : { ganbattaCount: { increment: 1 } },
                });
                if (post?.authorId && post.authorId !== userId) {
                    await tx.notification.create({
                        data: {
                            type,
                            userId: post.authorId,
                            actorId: userId,
                            postId,
                        },
                    });
                }
            }
        });
    }

    return NextResponse.json({ ok: true });
}
