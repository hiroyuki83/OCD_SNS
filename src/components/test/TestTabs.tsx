'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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

const TAB_GROUPS: Array<{
    label: string;
    keys: SelfAssessmentKey[];
}> = [
    {
        label: '気分・不安',
        keys: ['depression', 'mania', 'gad', 'panic', 'social-anxiety'],
    },
    {
        label: '強迫・トラウマ',
        keys: ['ocd', 'ptsd', 'cptsd'],
    },
    {
        label: '解離',
        keys: ['dpdr', 'dissociation'],
    },
    {
        label: 'その他',
        keys: ['personality', 'eating', 'sleep'],
    },
];

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
        return [
            {
                title: '直近の重症度',
                color: '#0284c7',
                items: profileItems(definition, result, definition.sections),
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
    ocdProfileDefinition,
    ocdProfileResults = [],
}: {
    definition: SelfAssessmentDefinition;
    results: SelfAssessmentResultView[];
    tabs: Array<{ key: SelfAssessmentKey; title: string; shortTitle: string }>;
    canSave: boolean;
    ocdProfileDefinition?: SelfAssessmentDefinition;
    ocdProfileResults?: SelfAssessmentResultView[];
}) {
    const router = useRouter();
    const [activeForm, setActiveForm] = useState<'main' | 'profile' | null>(null);
    const latest = results.at(-1);
    const latestOcdProfile = ocdProfileResults.at(-1);
    const trendIds = chooseTrendIds(definition, latest);
    const trendMax = Math.max(1, ...trendIds.map((id) => scoreMax(definition, id)));
    const isOcd = definition.key === 'ocd';
    const currentOcdProfileSections =
        isOcd && latestOcdProfile && ocdProfileDefinition
            ? ocdProfileDefinition.sections.filter(
                  (section) => (latestOcdProfile.subscaleScores[section.id] ?? 0) > 0,
              )
            : [];

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-white p-4 md:p-5">
                <select
                    id="assessment-selector"
                    value={definition.key}
                    onChange={(event) => {
                        setActiveForm(null);
                        router.push('/test?tab=' + encodeURIComponent(event.target.value));
                    }}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition focus:border-[#1d9bf0] focus:ring-2 focus:ring-[#1d9bf0]/20"
                    aria-label="セルフチェックの領域を選択"
                >
                    {TAB_GROUPS.map((group) => {
                        const groupedTabs = group.keys
                            .map((key) => tabs.find((tab) => tab.key === key))
                            .filter((tab): tab is (typeof tabs)[number] => Boolean(tab));

                        if (groupedTabs.length === 0) return null;

                        return (
                            <optgroup key={group.label} label={group.label}>
                                {groupedTabs.map((tab) => (
                                    <option key={tab.key} value={tab.key}>
                                        {tab.title}
                                    </option>
                                ))}
                            </optgroup>
                        );
                    })}
                </select>

                <div className="mt-4">
                    <h2 className="text-lg font-bold text-zinc-950">{definition.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{definition.subtitle}</p>
                    <p className="mt-2 text-xs text-zinc-400">回答期間：{definition.period}</p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setActiveForm(activeForm === 'main' ? null : 'main')}
                        className="rounded-full bg-sky-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-sky-600"
                    >
                        {activeForm === 'main'
                            ? 'チェックを閉じる'
                            : isOcd
                              ? '重症度をチェックする'
                              : 'セルフチェックを始める'}
                    </button>

                    {isOcd && ocdProfileDefinition && (
                        <button
                            type="button"
                            onClick={() => setActiveForm(activeForm === 'profile' ? null : 'profile')}
                            className="rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
                        >
                            {activeForm === 'profile'
                                ? 'プロフィールを閉じる'
                                : latestOcdProfile
                                  ? '症状プロフィールを確認・更新'
                                  : '症状プロフィールを作成'}
                        </button>
                    )}
                </div>
            </section>

            {activeForm === 'main' && (
                <SelfAssessmentForm
                    definition={definition}
                    canSave={canSave}
                    submitLabel={isOcd ? '重症度を保存する' : '結果を保存する'}
                />
            )}

            {activeForm === 'profile' && isOcd && ocdProfileDefinition && (
                <SelfAssessmentForm
                    definition={ocdProfileDefinition}
                    canSave={canSave}
                    submitLabel="症状プロフィールを保存する"
                />
            )}

            {(latest || (isOcd && latestOcdProfile)) && (
                <section className="space-y-4">
                    <div>
                        <h2 className="text-base font-bold text-zinc-950">あなたの記録</h2>
                        <p className="mt-1 text-xs text-zinc-500">
                            直近の状態と、これまでの変化を確認できます。
                        </p>
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

                    {isOcd && ocdProfileDefinition && (
                        <div className="rounded-2xl border border-border bg-white p-4 md:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-bold text-zinc-900">症状プロフィール</div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                        毎回のチェックは不要です。症状内容が変わったときに更新できます。
                                    </div>
                                </div>
                                {latestOcdProfile && (
                                    <div className="text-xs text-zinc-400">
                                        最終更新：{resultDateTimeLabel(latestOcdProfile.createdAt)}
                                    </div>
                                )}
                            </div>

                            {latestOcdProfile ? (
                                currentOcdProfileSections.length > 0 ? (
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {currentOcdProfileSections.map((section) => (
                                            <span
                                                key={section.id}
                                                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700"
                                            >
                                                {section.title}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-4 text-sm text-zinc-500">
                                        現在みられる症状として選択された領域はありません。
                                    </div>
                                )
                            ) : (
                                <div className="mt-4 text-sm text-zinc-500">
                                    症状プロフィールはまだ作成されていません。
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {!latest && !(isOcd && latestOcdProfile) && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-sm text-zinc-500">
                    保存された記録はまだありません。上のボタンからチェックを始められます。
                </div>
            )}

            {results.length > 0 && (
                <details className="rounded-2xl border border-border bg-white">
                    <summary className="cursor-pointer list-none px-4 py-4 text-sm font-bold text-zinc-900">
                        過去の記録を見る（{results.length}件）
                    </summary>
                    <div className="max-h-80 overflow-y-auto border-t border-zinc-100 px-4">
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
                </details>
            )}

            <details className="rounded-2xl border border-border bg-white">
                <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium text-zinc-600">
                    このセルフチェックについて
                </summary>
                <div className="border-t border-zinc-100 px-4 py-4 text-xs leading-relaxed text-zinc-500">
                    CoCo独自の経過モニタリング項目です。診断や治療、既存の標準化心理検査の代わりになるものではありません。現段階ではカットオフや「軽症・中等症・重症」の判定は行いません。保存した結果は本人のセルフチェックページだけに表示します。
                </div>
            </details>
        </div>
    );
}
