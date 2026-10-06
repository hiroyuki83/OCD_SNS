import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import TestTabs from '@/components/test/TestTabs';
import {
    ASSESSMENT_DEFINITIONS,
    ASSESSMENT_SUMMARIES,
    isSelfAssessmentKey,
} from '@/lib/selfAssessmentDefinitions';
import type { SelfAssessmentKey } from '@/lib/selfAssessmentTypes';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function resolveTab(value: string | string[] | undefined): SelfAssessmentKey {
    const tab = Array.isArray(value) ? value[0] : value;
    if (tab === 'ocd-profile') return 'ocd';
    return isSelfAssessmentKey(tab) ? tab : 'depression';
}

function toResultView(result: {
    id: string;
    createdAt: Date;
    totalScore: number | null;
    functionScore: number;
    subscaleScores: unknown;
    safetyFlags: unknown;
}) {
    return {
        id: result.id,
        createdAt: result.createdAt.toISOString(),
        totalScore: result.totalScore,
        functionScore: result.functionScore,
        subscaleScores: result.subscaleScores as Record<string, number>,
        safetyFlags: Array.isArray(result.safetyFlags)
            ? result.safetyFlags.filter((value): value is string => typeof value === 'string')
            : [],
    };
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
    if (!session?.user) redirect('/login');
    let userId = session.user.id ?? null;
    if (!userId && session?.user?.email) {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
        });
        userId = user?.id ?? null;
    }
    if (!userId) redirect('/login');

    const resultSelect = {
        id: true,
        createdAt: true,
        totalScore: true,
        functionScore: true,
        subscaleScores: true,
        safetyFlags: true,
    } as const;

    const results = userId
        ? await prisma.selfAssessmentResult.findMany({
              where: {
                  userId,
                  assessmentKey: activeTab,
              },
              orderBy: { createdAt: 'asc' },
              select: resultSelect,
          })
        : [];

    const ocdProfileResults =
        userId && activeTab === 'ocd'
            ? await prisma.selfAssessmentResult.findMany({
                  where: {
                      userId,
                      assessmentKey: 'ocd-profile',
                  },
                  orderBy: { createdAt: 'asc' },
                  select: resultSelect,
              })
            : [];

    return (
        <div className="min-h-screen border-r border-border">
            <div className="sticky top-0 z-10 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-md">
                <h1 className="text-base font-bold">セルフチェック</h1>
            </div>

            <div className="p-4">
                <TestTabs
                    definition={definition}
                    tabs={ASSESSMENT_SUMMARIES}
                    canSave={Boolean(session?.user)}
                    results={results.map(toResultView)}
                    ocdProfileDefinition={
                        activeTab === 'ocd' ? ASSESSMENT_DEFINITIONS['ocd-profile'] : undefined
                    }
                    ocdProfileResults={ocdProfileResults.map(toResultView)}
                />
            </div>
        </div>
    );
}
