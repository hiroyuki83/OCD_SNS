'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import YbocsForm from '@/components/test/YbocsForm';
import IesrForm from '@/components/test/IesrForm';
import ItqForm from '@/components/test/ItqForm';
import LsasForm from '@/components/test/LsasForm';

type YbocsResult = {
    id: string;
    createdAt: string;
    totalScore: number;
    obsessionsScore: number;
    compulsionsScore: number;
};

type IesrResult = {
    id: string;
    createdAt: string;
    totalScore: number;
    intrusionScore: number;
    avoidanceScore: number;
    hyperarousalScore: number;
};

type ItqResult = {
    id: string;
    createdAt: string;
    eventTiming: string;
    ptsdScore: number;
    dsoScore: number;
    reScore: number;
    avScore: number;
    thScore: number;
    adScore: number;
    nscScore: number;
    drScore: number;
    ptsdFunctional: boolean;
    dsoFunctional: boolean;
    ptsdMet: boolean;
    dsoMet: boolean;
    resultLabel: string;
};

type LsasResult = {
    id: string;
    createdAt: string;
    totalScore: number;
    fearScore: number;
    avoidScore: number;
    resultLabel: string;
};

function ScoreChart({
    scores,
    labels,
    statusLabels,
    maxScore,
}: {
    scores: number[];
    labels: string[];
    statusLabels: string[];
    maxScore: number;
}) {
    if (scores.length === 0) return null;

    const width = 640;
    const height = 200;
    const padding = 32;
    const xLabelOffset = 14;
    const statusLabelOffset = 6;
    const yAxisLabelOffset = 6;
    const points = scores.map((score, index) => {
        const x =
            scores.length === 1
                ? width / 2
                : padding + (index * (width - padding * 2)) / (scores.length - 1);
        const y = padding + ((maxScore - score) / maxScore) * (height - padding * 2);
        return { x, y };
    });
    const path = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    const gridLines = 5;
    const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => {
        const value = maxScore - (i * maxScore) / gridLines;
        const y = padding + (i * (height - padding * 2)) / gridLines;
        return { value, y };
    });

    return (
        <div className="border border-border rounded-2xl p-4">
            <div className="text-sm font-bold mb-2">スコア推移</div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52">
                <rect x="0" y="0" width={width} height={height} fill="transparent" />
                <g stroke="#27272a" strokeWidth="1">
                    {yTicks.map((tick) => (
                        <line key={tick.value} x1={padding} y1={tick.y} x2={width - padding} y2={tick.y} />
                    ))}
                </g>
                <path d={path} fill="none" stroke="#1d9bf0" strokeWidth="2" />
                {points.map((point, index) => (
                    <circle key={index} cx={point.x} cy={point.y} r="3" fill="#1d9bf0" />
                ))}
                <g fill="#a1a1aa" fontSize="10">
                    {labels.map((label, index) => {
                        const x =
                            labels.length === 1
                                ? width / 2
                                : padding + (index * (width - padding * 2)) / (labels.length - 1);
                        return (
                            <text key={label} x={x} y={height - xLabelOffset} textAnchor="middle">
                                {label}
                            </text>
                        );
                    })}
                </g>
                <g fill="#60a5fa" fontSize="9">
                    {statusLabels.map((label, index) => {
                        if (!label) return null;
                        const x =
                            statusLabels.length === 1
                                ? width / 2
                                : padding + (index * (width - padding * 2)) / (statusLabels.length - 1);
                        return (
                            <text key={`${label}-${index}`} x={x} y={height - statusLabelOffset} textAnchor="middle">
                                {label}
                            </text>
                        );
                    })}
                </g>
                <g fill="#71717a" fontSize="10" textAnchor="end">
                    {yTicks.map((tick) => (
                        <text key={`y-${tick.value}`} x={padding - yAxisLabelOffset} y={tick.y + 3}>
                            {Math.round(tick.value)}
                        </text>
                    ))}
                </g>
            </svg>
        </div>
    );
}

export default function TestTabs({
    ybocsResults,
    iesrResults,
    itqResults,
    lsasResults,
}: {
    ybocsResults: YbocsResult[];
    iesrResults: IesrResult[];
    itqResults: ItqResult[];
    lsasResults: LsasResult[];
}) {
    const searchParams = useSearchParams();
    const tabValue = searchParams.get('tab');
    const activeTab =
        tabValue === 'iesr'
            ? 'iesr'
            : tabValue === 'itq'
                ? 'itq'
                : tabValue === 'lsas'
                    ? 'lsas'
                    : 'ybocs';

    const ybocsScores = ybocsResults.map((result) => result.totalScore);
    const ybocsLabels = ybocsResults.map((result) =>
        new Date(result.createdAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }),
    );
    const ybocsStatusLabels = ybocsResults.map((result, index) => {
        if (index === 0) return '';
        const previous = ybocsResults[index - 1];
        const response =
            previous.totalScore > 0 &&
            (previous.totalScore - result.totalScore) / previous.totalScore >= 0.35;
        const remission = result.totalScore <= 12;
        if (remission) return '寛解';
        if (response) return '治療効果あり';
        return '';
    });
    const ybocsChartMinWidth = ybocsScores.length > 7 ? 640 + (ybocsScores.length - 7) * 120 : 640;

    const iesrScores = iesrResults.map((result) => result.totalScore);
    const iesrLabels = iesrResults.map((result) =>
        new Date(result.createdAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }),
    );
    const iesrChartMinWidth = iesrScores.length > 7 ? 640 + (iesrScores.length - 7) * 120 : 640;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border">
                <Link
                    href="/test?tab=ybocs"
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'ybocs'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    Y-BOCS
                </Link>
                <Link
                    href="/test?tab=iesr"
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'iesr'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    IES-R
                </Link>
                <Link
                    href="/test?tab=itq"
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'itq'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    ITQ
                </Link>
                <Link
                    href="/test?tab=lsas"
                    className={`px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'lsas'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    LSAS
                </Link>
            </div>

            {activeTab === 'ybocs' && ybocsResults.length > 0 && (
                <>
                    <div className="border border-border rounded-2xl p-4 space-y-3">
                        <div className="text-sm font-bold">スコア推移</div>
                        <div className="overflow-x-auto pb-2">
                            <div style={{ minWidth: `${ybocsChartMinWidth}px` }}>
                                <ScoreChart
                                    scores={ybocsScores}
                                    labels={ybocsLabels}
                                    statusLabels={ybocsStatusLabels}
                                    maxScore={50}
                                />
                            </div>
                        </div>
                        <div className="text-xs text-zinc-500">
                            {ybocsResults.length > 7 && '横スクロールで過去のスコアを確認できます。'}
                        </div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-400">目安</div>
                        <div>寛解 12以下</div>
                        <div>軽症 15〜21点</div>
                        <div>中等症 22〜34点</div>
                        <div>重症 35〜50点</div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
                        <div className="text-sm font-bold">履歴</div>
                        <div className="grid gap-2 text-sm">
                            {ybocsResults
                                .slice()
                                .reverse()
                                .map((result) => {
                                    const chronologicalIndex = ybocsResults.findIndex((item) => item.id === result.id);
                                    const previous =
                                        chronologicalIndex > 0 ? ybocsResults[chronologicalIndex - 1] : null;
                                    const response =
                                        previous &&
                                        previous.totalScore > 0 &&
                                        (previous.totalScore - result.totalScore) / previous.totalScore >= 0.35;
                                    const remission = result.totalScore <= 12;

                                    return (
                                        <div
                                            key={result.id}
                                            className="grid items-center gap-2 text-zinc-400"
                                            style={{
                                                gridTemplateColumns:
                                                    'minmax(140px,1.2fr) minmax(90px,0.8fr) minmax(80px,0.6fr) minmax(90px,0.7fr) minmax(90px,0.7fr)',
                                            }}
                                        >
                                            <span>
                                                {new Date(result.createdAt).toLocaleString('ja-JP', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                {response && <span className="text-[#1d9bf0]">治療効果あり</span>}
                                                {remission && <span className="text-green-400">寛解</span>}
                                            </span>
                                            <span>合計 {result.totalScore}</span>
                                            <span>強迫観念 {result.obsessionsScore}</span>
                                            <span>強迫行為 {result.compulsionsScore}</span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'iesr' && iesrResults.length > 0 && (
                <>
                    <div className="border border-border rounded-2xl p-4 space-y-3">
                        <div className="text-sm font-bold">スコア推移</div>
                        <div className="overflow-x-auto pb-2">
                            <div style={{ minWidth: `${iesrChartMinWidth}px` }}>
                                <ScoreChart
                                    scores={iesrScores}
                                    labels={iesrLabels}
                                    statusLabels={new Array(iesrScores.length).fill('')}
                                    maxScore={88}
                                />
                            </div>
                        </div>
                        <div className="text-xs text-zinc-500">
                            {iesrResults.length > 7 && '横スクロールで過去のスコアを確認できます。'}
                        </div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-400">目安</div>
                        <div>合計点 24 / 25 点がスクリーニングの境界値</div>
                        <div>医学的な診断に代わるものではありません。</div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
                        <div className="text-sm font-bold">履歴</div>
                        <div className="grid gap-2 text-sm">
                            {iesrResults
                                .slice()
                                .reverse()
                                .map((result) => (
                                    <div
                                        key={result.id}
                                        className="grid items-center gap-2 text-zinc-400"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(90px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr)',
                                        }}
                                    >
                                        <span>
                                            {new Date(result.createdAt).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        <span>合計 {result.totalScore}</span>
                                        <span>侵入 {result.intrusionScore}</span>
                                        <span>回避 {result.avoidanceScore}</span>
                                        <span>過覚醒 {result.hyperarousalScore}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'itq' && itqResults.length > 0 && (
                <>
                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-400">判定</div>
                        <div>PTSD / CPTSD の可能性をスクリーニングします。</div>
                        <div>※CPTSDの基準を満たしている場合、PTSDの診断は受けません（CPTSDに含まれます）。</div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
                        <div className="text-sm font-bold">履歴</div>
                        <div className="grid gap-2 text-sm">
                            {itqResults
                                .slice()
                                .reverse()
                                .map((result) => (
                                    <div
                                        key={result.id}
                                        className="grid items-center gap-2 text-zinc-400"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(180px,1.2fr) minmax(80px,0.7fr) minmax(80px,0.7fr) minmax(120px,0.9fr)',
                                        }}
                                    >
                                        <span>
                                            {new Date(result.createdAt).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        <span className="text-zinc-300">{result.resultLabel}</span>
                                        <span>PTSD {result.ptsdScore}</span>
                                        <span>DSO {result.dsoScore}</span>
                                        <span className="text-xs">
                                            侵入 {result.reScore} / 回避 {result.avScore} / 過覚醒 {result.thScore}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'lsas' && lsasResults.length > 0 && (
                <>
                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-400">判定</div>
                        <div>総合得点に基づいて判定します。</div>
                    </div>
                    <div className="border border-border rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
                        <div className="text-sm font-bold">履歴</div>
                        <div className="grid gap-2 text-sm">
                            {lsasResults
                                .slice()
                                .reverse()
                                .map((result) => (
                                    <div
                                        key={result.id}
                                        className="grid items-center gap-2 text-zinc-400"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(140px,1fr) minmax(80px,0.7fr) minmax(90px,0.8fr) minmax(90px,0.8fr)',
                                        }}
                                    >
                                        <span>
                                            {new Date(result.createdAt).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                        <span className="text-zinc-300">{result.resultLabel}</span>
                                        <span>合計 {result.totalScore}</span>
                                        <span>恐怖 {result.fearScore}</span>
                                        <span>回避 {result.avoidScore}</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'ybocs' ? (
                <YbocsForm />
            ) : activeTab === 'iesr' ? (
                <IesrForm />
            ) : activeTab === 'itq' ? (
                <ItqForm />
            ) : (
                <LsasForm />
            )}
        </div>
    );
}
