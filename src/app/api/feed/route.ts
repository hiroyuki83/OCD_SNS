import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { privateJson } from '@/lib/apiResponse';
import { getFeedData, type FeedTab } from '@/lib/feedData';
import { parsePageNumber } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tab: FeedTab =
        searchParams.get('tab') === 'following' ? 'following' : 'for-you';
    const requestedPage = parsePageNumber(searchParams.get('page'));

    const session = await auth();
    if (!session?.user) {
        return privateJson({ ok: false }, { status: 401 });
    }
    let userId = session.user.id ?? null;

    const sessionEmail = session.user.email;
    if (!userId && sessionEmail) {
        const user = await prisma.user.findUnique({
            where: { email: sessionEmail },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }
    if (!userId) {
        return privateJson({ ok: false }, { status: 401 });
    }

    const data = await getFeedData({
        userId,
        tab,
        requestedPage,
    });

    return privateJson(data);
}
