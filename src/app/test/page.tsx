import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import TestTabs from '@/components/test/TestTabs';
import {
    ASSESSMENT_DEFINITIONS,
    ASSESSMENT_SUMMARIES,
    isSelfAssessmentKey,
} from '@/lib/selfAssessmentDefinitions';
import type { SelfAssessmentKey } from '@/lib/selfAssessmentTypes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveTab(value: string | string[] | undefined): SelfAssessmentKey {
    const tab = Array.isArray(value) ? value[0] : value;
    return isSelfAssessmentKey(tab) ? tab : 'depression';
}

export default async function TestPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string | string[] }>;
}) {
    const params = await searchParams;
    const activeTab = resolveTab(params.tab);
    const definition = ASSESSMENT_DEFINITIONS[activeTab];

    const session = await auth();
    let userId = session?.user?.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }

    const results = userId
        ? await prisma.selfAssessmentResult.findMany({
              where: {
                  userId,
                  assessmentKey: activeTab,
              },
              orderBy: { createdAt: 'asc' },
              select: {
                  id: true,
                  createdAt: true,
                  totalScore: true,
                  functionScore: true,
                  subscaleScores: true,
                  safetyFlags: true,
              },
          })
        : [];

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md">
                <h1 className="text-base font-bold">セルフチェック</h1>
            </div>

            {!session?.user && (
                <div className="p-6 text-sm text-zinc-400">
                    結果を保存するにはログインが必要です
                </div>
            )}

            <div className="space-y-6 p-4">
                <div className="rounded-2xl border border-border p-4 text-xs leading-relaxed text-zinc-500">
                    CoCo独自の経過モニタリング項目です。診断や治療、標準化された心理検査の代わりにはなりません。保存した結果は本人のセルフチェックページだけに表示し、公開プロフィールや通常の管理画面には表示しません。
                </div>

                <TestTabs
                    definition={definition}
                    tabs={ASSESSMENT_SUMMARIES}
                    canSave={Boolean(session?.user)}
                    results={results.map((result) => ({
                        id: result.id,
                        createdAt: result.createdAt.toISOString(),
                        totalScore: result.totalScore,
                        functionScore: result.functionScore,
                        subscaleScores: result.subscaleScores as Record<string, number>,
                        safetyFlags: Array.isArray(result.safetyFlags)
                            ? result.safetyFlags.filter((value): value is string => typeof value === 'string')
                            : [],
                    }))}
                />
            </div>
        </div>
    );
}
