import Feed from "@/components/feed/Feed";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getFeedData, type FeedTab } from "@/lib/feedData";
import { parsePageNumber } from "@/lib/pagination";
import { redirect } from "next/navigation";

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
  if (!session?.user) redirect("/login");
  let userId = session.user.id ?? null;

  const sessionEmail = session.user.email;
  if (!userId && sessionEmail) {
    const user = await prisma.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }
  if (!userId) redirect("/login");

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
