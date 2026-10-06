import Feed from "@/components/feed/Feed";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getFeedData, type FeedTab } from "@/lib/feedData";
import { parsePageNumber } from "@/lib/pagination";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ compose?: string; tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  const focusCompose = params.compose === "1";
  const tab: FeedTab = params.tab === "following" ? "following" : "for-you";
  const requestedPage = parsePageNumber(params.page);

  const session = await auth();
  let userId = session?.user?.id ?? null;

  if (!userId && session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const now = new Date();
  const [initialData, announcements] = await Promise.all([
    getFeedData({
      userId,
      tab,
      requestedPage,
    }),
    prisma.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        href: true,
      },
    }),
  ]);

  return (
    <Feed
      key={`${tab}:${initialData.page}`}
      focusCompose={focusCompose}
      initialData={initialData}
      announcements={announcements}
    />
  );
}
