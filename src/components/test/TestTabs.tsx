'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useTransition } from 'react';
import AssessmentOverview, {
    type AssessmentProfileGroup,
} from '@/components/test/AssessmentOverview';
import { deleteGenericSelfAssessmentResult } from '@/app/test/actions';
import type {
    AssessmentSection,
    SelfAssessmentDefinition,
    SelfAssessmentKey,
    SelfAssessmentResultView,
} from '@/lib/selfAssessmentTypes';

const SelfAssessmentForm = dynamic(() => import('@/components/test/SelfAssessmentForm'), {
    loading: () => <div className="text-sm text-zinc-500">セルフチェックを読み込んでいます...</div>,
});

const TREND_COLORS = ['#0284c7', '#0f766e', '#7c3aed', '#c2410c', '#be123c'];

function resultDateLabel(value: string) {
    return new Date(value).toLocaleDateString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
    });
}

function resultDateTimeLabel(value: string) {
    return new Date(value).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function optionMax(values: Array<{ value: number }>) {
    return Math.max(...values.map((option) => option.value));
}

function sectionMax(definition: SelfAssessmentDefinition, section: AssessmentSection) {
    if (section.scoringMode === 'currentCount') return section.items.length;
    return section.items.reduce(
        (sum, item) => sum + optionMax(item.options ?? definition.defaultOptions),
        0,
    );
}

function totalMax(definition: SelfAssessmentDefinition) {
    return definition.sections
        .filter((section) => section.scored !== false)
        .reduce((sum, section) => sum + sectionMax(definition, section), 0);
}

function derivedMax(definition: SelfAssessmentDefinition, id: string) {
    const derived = definition.derivedScores?.find((item) => item.id === id);
    if (!derived) return null;
    return derived.sectionIds.reduce((sum, sectionId) => {
        const section = definition.sections.find((item) => item.id === sectionId);
        return sum + (section ? sectionMax(definition, section) : 0);
    }, 0);
}

function scoreMax(definition: SelfAssessmentDefinition, id: string) {
    if (id === '$total') return totalMax(definition);
    const derived = derivedMax(definition, id);
    if (derived !== null) return derived;
    const section = definition.sections.find((item) => item.id === id);
    return section ? sectionMax(definition, section) : 1;
}

function scoreLabel(definition: SelfAssessmentDefinition, id: string) {
    if (id === '$total') return '総合';
    const derived = definition.derivedScores?.find((item) => item.id === id);
    if (derived) return derived.label;
    return definition.sections.find((item) => item.id === id)?.title ?? id;
}

function scoreValue(result: SelfAssessmentResultView, id: string) {
    if (id === '$total') return result.totalScore ?? 0;
    return result.subscaleScores[id] ?? 0;
}

function chooseTrendIds(
    definition: SelfAssessmentDefinition,
    latest: SelfAssessmentResultView | undefined,
) {
    if (definition.primaryTrendIds && definition.primaryTrendIds.length > 0) {
        return definition.primaryTrendIds;
    }
    if (definition.showTotal) return ['$total'];
    if (!latest) return [];

    return definition.sections
        .filter((section) => section.profile !== false)
        .map((section) => ({
            id: section.id,
            ratio:
                (latest.subscaleScores[section.id] ?? 0) /
                Math.max(1, sectionMax(definition, section)),
        }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3)
        .map((item) => item.id);
}

function profileItems(
    definition: SelfAssessmentDefinition,
    result: SelfAssessmentResultView,
    sections: AssessmentSection[],
) {
    return sections
        .filter((section) => section.profile !== false)
        .map((section) => ({
            label: section.title,
            value: result.subscaleScores[section.id] ?? 0,
            max: sectionMax(definition, section),
        }));
}

function buildProfileGroups(
    definition: SelfAssessmentDefinition,
    result: SelfAssessmentResultView,
): AssessmentProfileGroup[] {
    if (definition.key === 'ocd') {
        const severityIds = new Set(['obsessionSeverity', 'compulsionSeverity', 'avoidanceSeverity']);
        return [
            {
                title: '強迫観念・強迫行為・回避',
                color: '#0284c7',
                items: profileItems(
                    definition,
                    result,
                    definition.sections.filter((section) => severityIds.has(section.id)),
                ),
            },
            {
                title: '現在みられる症状内容',
                color: '#0f766e',
                items: profileItems(
                    definition,
                    result,
                    definition.sections.filter((section) => !severityIds.has(section.id)),
                ),
            },
        ];
    }

    if (definition.key === 'cptsd') {
        const ptsdIds = new Set(['reexperiencing', 'traumaAvoidance', 'threat']);
        return [
            {
                title: 'PTSD中核症状',
                color: '#0284c7',
                items: profileItems(
                    definition,
                    result,
                    definition.sections.filter((section) => ptsdIds.has(section.id)),
                ),
            },
            {
                title: '自己組織化の困難',
                color: '#0f766e',
                items: profileItems(
                    definition,
                    result,
                    definition.sections.filter((section) => !ptsdIds.has(section.id)),
                ),
            },
        ];
    }

    return [
        {
            title: '直近の領域別プロフィール',
            color: '#0284c7',
            items: profileItems(definition, result, definition.sections),
        },
    ];
}

function DeleteResultButton({
    assessmentKey,
    resultId,
}: {
    assessmentKey: SelfAssessmentKey;
    resultId: string;
}) {
    const [pending, startTransition] = useTransition();

    return (
        <button
            type="button"
            disabled={pending}
            onClick={() => {
                if (!window.confirm('この保存結果を削除しますか？この操作は元に戻せません。')) return;
                startTransition(async () => {
                    await deleteGenericSelfAssessmentResult(assessmentKey, resultId);
                    window.location.reload();
                });
            }}
            className="text-xs text-red-500 hover:underline disabled:text-zinc-400"
        >
            {pending ? '削除中...' : '削除'}
        </button>
    );
}

export default function TestTabs({
    definition,
    results,
    tabs,
    canSave,
}: {
    definition: SelfAssessmentDefinition;
    results: SelfAssessmentResultView[];
    tabs: Array<{ key: SelfAssessmentKey; title: string; shortTitle: string }>;
    canSave: boolean;
}) {
    const latest = results.at(-1);
    const trendIds = chooseTrendIds(definition, latest);
    const trendMax = Math.max(1, ...trendIds.map((id) => scoreMax(definition, id)));

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={'/test?tab=' + encodeURIComponent(tab.key)}
                        title={tab.title}
                        className={
                            'shrink-0 px-3 py-2 text-sm font-bold transition-colors ' +
                            (definition.key === tab.key
                                ? 'border-b-2 border-[#1d9bf0] text-[#1d9bf0]'
                                : 'text-zinc-500 hover:text-zinc-700')
                        }
                    >
                        {tab.shortTitle}
                    </Link>
                ))}
            </div>

            {latest && trendIds.length > 0 && (
                <AssessmentOverview
                    title={definition.title}
                    subtitle={definition.subtitle}
                    labels={results.map((result) => resultDateLabel(result.createdAt))}
                    trendSeries={trendIds.map((id, index) => ({
                        label: scoreLabel(definition, id),
                        color: TREND_COLORS[index % TREND_COLORS.length],
                        values: results.map((result) => scoreValue(result, id)),
                    }))}
                    maxScore={trendMax}
                    summaryItems={[
                        ...trendIds.map((id) => ({
                            label: scoreLabel(definition, id),
                            value: scoreValue(latest, id),
                            max: scoreMax(definition, id),
                        })),
                        {
                            label: '生活への影響',
                            value: latest.functionScore,
                            max: 20,
                        },
                    ]}
                    profileGroups={buildProfileGroups(definition, latest)}
                />
            )}

            {!latest && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
                    このセルフチェックの保存結果はまだありません。回答すると、ここに経時変化と領域プロフィールが表示されます。
                </div>
            )}

            {results.length > 0 && (
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-border bg-white p-4">
                    <div className="mb-2 text-sm font-bold text-zinc-900">履歴</div>
                    <div className="divide-y divide-zinc-100">
                        {results
                            .slice()
                            .reverse()
                            .map((result) => (
                                <div
                                    key={result.id}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs text-zinc-500"
                                >
                                    <span>{resultDateTimeLabel(result.createdAt)}</span>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {definition.showTotal && result.totalScore !== null && (
                                            <span>
                                                総合 {result.totalScore} / {totalMax(definition)}
                                            </span>
                                        )}
                                        <span>生活への影響 {result.functionScore} / 20</span>
                                        <DeleteResultButton
                                            assessmentKey={definition.key}
                                            resultId={result.id}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-relaxed text-sky-900">
                このセルフチェックはCoCo独自の経過モニタリング項目です。診断や既存の標準化心理検査の代わりになるものではありません。現段階ではカットオフや「軽症・中等症・重症」の判定は行いません。
            </div>

            <SelfAssessmentForm definition={definition} canSave={canSave} />
        </div>
    );
}
