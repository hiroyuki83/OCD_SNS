import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { privateJson } from '@/lib/apiResponse';
import { accessiblePostWhere } from '@/lib/postAccess';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    if (!id || id.length > 128) {
        return privateJson({ post: null }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
        return privateJson({ post: null }, { status: 401 });
    }
    let viewerId: string | null = session.user.id ?? null;
    const sessionEmail = session.user.email;
    if (!viewerId && sessionEmail) {
        const viewer = await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: { id: true },
        });
        viewerId = viewer?.id ?? null;
    }
    if (!viewerId) {
        return privateJson({ post: null }, { status: 401 });
    }

    const post = await prisma.post.findFirst({
        where: accessiblePostWhere(viewerId, id),
        select: {
            id: true,
            content: true,
            createdAt: true,
            author: {
                select: {
                    id: true,
                    name: true,
                    handle: true,
                    avatarUrl: true,
                },
            },
        },
    });

    if (!post) {
        return privateJson({ post: null }, { status: 404 });
    }

    return privateJson({
        post: {
            id: post.id,
            content: post.content,
            createdAt: post.createdAt,
            author: post.author,
        },
    });
}
