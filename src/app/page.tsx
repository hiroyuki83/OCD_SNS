import Feed from "@/components/feed/Feed";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home({
  searchParams,
}: {
  searchParams?: { compose?: string; tab?: string };
}) {
  const focusCompose = searchParams?.compose === "1";
  const session = await auth();
  let userId = session?.user?.id ?? null;
  let avatarUrl: string | null = null;
  if (!userId && session?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, avatarUrl: true },
    });
    userId = user?.id ?? null;
    avatarUrl = user?.avatarUrl ?? null;
  } else if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    avatarUrl = user?.avatarUrl ?? null;
  }
  return <Feed focusCompose={focusCompose} initialViewerId={userId} initialViewerAvatarUrl={avatarUrl} />;
}
