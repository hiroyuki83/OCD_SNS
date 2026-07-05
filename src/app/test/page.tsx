import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import TestTabs from '@/components/test/TestTabs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TestPage() {
    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    const ybocsResults = userId
        ? await prisma.ybocsResult.findMany({
              where: { userId },
              orderBy: { createdAt: 'asc' },
              select: {
                  id: true,
                  createdAt: true,
                  totalScore: true,
                  obsessionsScore: true,
                  compulsionsScore: true,
              },
          })
        : [];

    const iesrResults = userId
        ? await prisma.iesrResult.findMany({
              where: { userId },
              orderBy: { createdAt: 'asc' },
              select: {
                  id: true,
                  createdAt: true,
                  totalScore: true,
                  intrusionScore: true,
                  avoidanceScore: true,
                  hyperarousalScore: true,
              },
          })
        : [];

    const itqResults = userId
        ? await prisma.itqResult.findMany({
              where: { userId },
              orderBy: { createdAt: 'asc' },
              select: {
                  id: true,
                  createdAt: true,
                  eventTiming: true,
                  ptsdScore: true,
                  dsoScore: true,
                  reScore: true,
                  avScore: true,
                  thScore: true,
                  adScore: true,
                  nscScore: true,
                  drScore: true,
                  ptsdFunctional: true,
                  dsoFunctional: true,
                  ptsdMet: true,
                  dsoMet: true,
                  resultLabel: true,
              },
          })
        : [];

    const lsasResults = userId
        ? await prisma.lsasResult.findMany({
              where: { userId },
              orderBy: { createdAt: 'asc' },
              select: {
                  id: true,
                  createdAt: true,
                  totalScore: true,
                  fearScore: true,
                  avoidScore: true,
                  resultLabel: true,
              },
          })
        : [];

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 backdrop-blur-md bg-background/80 border-b border-border h-14 flex items-center px-4">
                <h1 className="font-bold text-base">心理検査</h1>
            </div>

            {!session?.user && (
                <div className="p-6 text-sm text-zinc-400">
                    テストを保存するにはログインが必要です
                </div>
            )}

            <div className="p-4 space-y-6">
                <div className="text-xs text-zinc-500 leading-relaxed border border-border rounded-2xl p-4">
                    このテストは自己チェック用です。診断や治療の代わりにはなりません。
                </div>
                <TestTabs
                    ybocsResults={ybocsResults.map((result) => ({
                        ...result,
                        createdAt: result.createdAt.toISOString(),
                    }))}
                    iesrResults={iesrResults.map((result) => ({
                        ...result,
                        createdAt: result.createdAt.toISOString(),
                    }))}
                    itqResults={itqResults.map((result) => ({
                        ...result,
                        createdAt: result.createdAt.toISOString(),
                    }))}
                    lsasResults={lsasResults.map((result) => ({
                        ...result,
                        createdAt: result.createdAt.toISOString(),
                    }))}
                />
            </div>
        </div>
    );
}
