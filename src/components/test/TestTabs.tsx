'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import AssessmentOverview, {
    type AssessmentBand,
} from '@/components/test/AssessmentOverview';
import { deleteSelfTestResult } from '@/app/lib/actions';

const formLoading = () => <div className="text-sm text-zinc-500">検査フォームを読み込んでいます...</div>;
const YbocsForm = dynamic(() => import('@/components/test/YbocsForm'), { loading: formLoading });
const IesrForm = dynamic(() => import('@/components/test/IesrForm'), { loading: formLoading });
const ItqForm = dynamic(() => import('@/components/test/ItqForm'), { loading: formLoading });
const LsasForm = dynamic(() => import('@/components/test/LsasForm'), { loading: formLoading });

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

const YBOCS_BANDS: AssessmentBand[] = [
    { label: '寛解（12以下）', min: 0, max: 12, fill: '#dcfce7' },
    { label: '', min: 12, max: 15, fill: '#f4f4f5' },
    { label: '軽症（15〜21）', min: 15, max: 21, fill: '#e0f2fe' },
    { label: '中等症（22〜34）', min: 22, max: 34, fill: '#fef3c7' },
    { label: '重症（35〜50）', min: 35, max: 50, fill: '#fee2e2' },
];

const LSAS_BANDS: AssessmentBand[] = [
    { label: '正常範囲（0〜29）', min: 0, max: 29, fill: '#dcfce7' },
    { label: '境界域（30〜49）', min: 30, max: 49, fill: '#e0f2fe' },
    { label: '中程度（50〜69）', min: 50, max: 69, fill: '#fef3c7' },
    { label: '症状が著しい（70〜89）', min: 70, max: 89, fill: '#ffedd5' },
    { label: '重度（90〜144）', min: 90, max: 144, fill: '#fee2e2' },
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

function deltaLabel(current: number, previous?: number) {
    if (previous === undefined) return undefined;
    const delta = current - previous;
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}（前回 ${previous}）`;
}

function ybocsSeverity(score: number) {
    if (score <= 12) return '寛解';
    if (score >= 15 && score <= 21) return '軽症';
    if (score >= 22 && score <= 34) return '中等症';
    if (score >= 35) return '重症';
    return undefined;
}

function DeleteResultButton({
    testType,
    resultId,
}: {
    testType: 'ybocs' | 'iesr' | 'itq' | 'lsas';
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
                    await deleteSelfTestResult(testType, resultId);
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

    const latestYbocs = ybocsResults.at(-1);
    const previousYbocs = ybocsResults.at(-2);
    const latestIesr = iesrResults.at(-1);
    const previousIesr = iesrResults.at(-2);
    const latestItq = itqResults.at(-1);
    const latestLsas = lsasResults.at(-1);
    const previousLsas = lsasResults.at(-2);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 overflow-x-auto border-b border-border">
                <Link
                    href="/test?tab=ybocs"
                    className={`shrink-0 px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'ybocs'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    Y-BOCS
                </Link>
                <Link
                    href="/test?tab=iesr"
                    className={`shrink-0 px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'iesr'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    IES-R
                </Link>
                <Link
                    href="/test?tab=itq"
                    className={`shrink-0 px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'itq'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    ITQ
                </Link>
                <Link
                    href="/test?tab=lsas"
                    className={`shrink-0 px-4 py-2 text-sm font-bold transition-colors ${
                        activeTab === 'lsas'
                            ? 'text-[#1d9bf0] border-b-2 border-[#1d9bf0]'
                            : 'text-zinc-500 hover:text-zinc-700'
                    }`}
                >
                    LSAS
                </Link>
            </div>

            {activeTab === 'ybocs' && latestYbocs && (
                <>
                    <AssessmentOverview
                        title="Y-BOCS"
                        subtitle="強迫症状の経過と、直近の強迫観念・強迫行為"
                        labels={ybocsResults.map((result) => resultDateLabel(result.createdAt))}
                        trendSeries={[
                            {
                                label: '合計',
                                color: '#0284c7',
                                values: ybocsResults.map((result) => result.totalScore),
                            },
                        ]}
                        maxScore={50}
                        summaryItems={[
                            {
                                label: '今回のスコア',
                                value: latestYbocs.totalScore,
                                max: 50,
                            },
                        ]}
                        statusLabel={ybocsSeverity(latestYbocs.totalScore)}
                        deltaLabel={deltaLabel(latestYbocs.totalScore, previousYbocs?.totalScore)}
                        bands={YBOCS_BANDS}
                        profileGroups={[
                            {
                                title: '直近の内訳',
                                color: '#0284c7',
                                items: [
                                    {
                                        label: '強迫観念',
                                        value: latestYbocs.obsessionsScore,
                                        max: 25,
                                    },
                                    {
                                        label: '強迫行為',
                                        value: latestYbocs.compulsionsScore,
                                        max: 25,
                                    },
                                ],
                            },
                        ]}
                    />

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
                                            className="grid items-center gap-2 text-zinc-500"
                                            style={{
                                                gridTemplateColumns:
                                                    'minmax(140px,1.2fr) minmax(90px,0.8fr) minmax(80px,0.6fr) minmax(90px,0.7fr) minmax(90px,0.7fr) minmax(50px,0.4fr)',
                                            }}
                                        >
                                            <span>{resultDateTimeLabel(result.createdAt)}</span>
                                            <span className="flex items-center gap-2">
                                                {response && <span className="text-[#1d9bf0]">治療効果あり</span>}
                                                {remission && <span className="text-green-600">寛解</span>}
                                            </span>
                                            <span>合計 {result.totalScore}</span>
                                            <span>強迫観念 {result.obsessionsScore}</span>
                                            <span>強迫行為 {result.compulsionsScore}</span>
                                            <DeleteResultButton testType="ybocs" resultId={result.id} />
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'iesr' && latestIesr && (
                <>
                    <AssessmentOverview
                        title="IES-R"
                        subtitle="心的外傷後ストレス症状の経過と、直近の症状プロフィール"
                        labels={iesrResults.map((result) => resultDateLabel(result.createdAt))}
                        trendSeries={[
                            {
                                label: '合計',
                                color: '#0284c7',
                                values: iesrResults.map((result) => result.totalScore),
                            },
                        ]}
                        maxScore={88}
                        summaryItems={[
                            {
                                label: '今回のスコア',
                                value: latestIesr.totalScore,
                                max: 88,
                            },
                        ]}
                        statusLabel={latestIesr.totalScore >= 25 ? '境界値以上' : '境界値未満'}
                        deltaLabel={deltaLabel(latestIesr.totalScore, previousIesr?.totalScore)}
                        profileGroups={[
                            {
                                title: '直近の下位尺度',
                                color: '#0ea5e9',
                                items: [
                                    {
                                        label: '侵入症状',
                                        value: latestIesr.intrusionScore,
                                        max: 32,
                                    },
                                    {
                                        label: '回避',
                                        value: latestIesr.avoidanceScore,
                                        max: 32,
                                    },
                                    {
                                        label: '過覚醒',
                                        value: latestIesr.hyperarousalScore,
                                        max: 24,
                                    },
                                ],
                            },
                        ]}
                    />

                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-600">目安</div>
                        <div>合計点 24 / 25 点がスクリーニングの境界値です。</div>
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
                                        className="grid items-center gap-2 text-zinc-500"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(90px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(50px,0.4fr)',
                                        }}
                                    >
                                        <span>{resultDateTimeLabel(result.createdAt)}</span>
                                        <span>合計 {result.totalScore}</span>
                                        <span>侵入 {result.intrusionScore}</span>
                                        <span>回避 {result.avoidanceScore}</span>
                                        <span>過覚醒 {result.hyperarousalScore}</span>
                                        <DeleteResultButton testType="iesr" resultId={result.id} />
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'itq' && latestItq && (
                <>
                    <AssessmentOverview
                        title="ITQ"
                        subtitle="PTSD症状とDSO症状の経過、直近の6領域"
                        labels={itqResults.map((result) => resultDateLabel(result.createdAt))}
                        trendSeries={[
                            {
                                label: 'PTSD',
                                color: '#0284c7',
                                values: itqResults.map((result) => result.ptsdScore),
                            },
                            {
                                label: 'DSO',
                                color: '#0f766e',
                                values: itqResults.map((result) => result.dsoScore),
                            },
                        ]}
                        maxScore={24}
                        summaryItems={[
                            {
                                label: 'PTSD症状',
                                value: latestItq.ptsdScore,
                                max: 24,
                            },
                            {
                                label: 'DSO症状',
                                value: latestItq.dsoScore,
                                max: 24,
                            },
                        ]}
                        statusLabel={latestItq.resultLabel}
                        profileGroups={[
                            {
                                title: 'PTSD（3領域）',
                                color: '#0284c7',
                                items: [
                                    { label: '再体験', value: latestItq.reScore, max: 8 },
                                    { label: '回避', value: latestItq.avScore, max: 8 },
                                    { label: '脅威感', value: latestItq.thScore, max: 8 },
                                ],
                            },
                            {
                                title: 'DSO（自己組織化の障害）',
                                color: '#0f766e',
                                items: [
                                    { label: '感情調整困難', value: latestItq.adScore, max: 8 },
                                    { label: '否定的自己概念', value: latestItq.nscScore, max: 8 },
                                    { label: '対人関係困難', value: latestItq.drScore, max: 8 },
                                ],
                            },
                        ]}
                    />

                    <div className="border border-border rounded-2xl p-4 text-xs text-zinc-500 space-y-2">
                        <div className="font-bold text-zinc-600">判定</div>
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
                                        className="grid items-center gap-2 text-zinc-500"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(180px,1.2fr) minmax(80px,0.7fr) minmax(80px,0.7fr) minmax(120px,0.9fr) minmax(50px,0.4fr)',
                                        }}
                                    >
                                        <span>{resultDateTimeLabel(result.createdAt)}</span>
                                        <span>{result.resultLabel}</span>
                                        <span>PTSD {result.ptsdScore}</span>
                                        <span>DSO {result.dsoScore}</span>
                                        <span className="text-xs">
                                            再体験 {result.reScore} / 回避 {result.avScore} / 脅威感 {result.thScore}
                                        </span>
                                        <DeleteResultButton testType="itq" resultId={result.id} />
                                    </div>
                                ))}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'lsas' && latestLsas && (
                <>
                    <AssessmentOverview
                        title="LSAS-J"
                        subtitle="社交不安症状の経過と、直近の恐怖・不安／回避"
                        labels={lsasResults.map((result) => resultDateLabel(result.createdAt))}
                        trendSeries={[
                            {
                                label: '合計',
                                color: '#0284c7',
                                values: lsasResults.map((result) => result.totalScore),
                            },
                        ]}
                        maxScore={144}
                        summaryItems={[
                            {
                                label: '今回のスコア',
                                value: latestLsas.totalScore,
                                max: 144,
                            },
                        ]}
                        statusLabel={latestLsas.resultLabel}
                        deltaLabel={deltaLabel(latestLsas.totalScore, previousLsas?.totalScore)}
                        bands={LSAS_BANDS}
                        profileGroups={[
                            {
                                title: '直近の内訳',
                                color: '#0284c7',
                                items: [
                                    {
                                        label: '恐怖感 / 不安感',
                                        value: latestLsas.fearScore,
                                        max: 72,
                                    },
                                    {
                                        label: '回避',
                                        value: latestLsas.avoidScore,
                                        max: 72,
                                    },
                                ],
                            },
                        ]}
                    />

                    <div className="border border-border rounded-2xl p-4 space-y-2 max-h-80 overflow-y-auto">
                        <div className="text-sm font-bold">履歴</div>
                        <div className="grid gap-2 text-sm">
                            {lsasResults
                                .slice()
                                .reverse()
                                .map((result) => (
                                    <div
                                        key={result.id}
                                        className="grid items-center gap-2 text-zinc-500"
                                        style={{
                                            gridTemplateColumns:
                                                'minmax(140px,1.2fr) minmax(140px,1fr) minmax(80px,0.7fr) minmax(90px,0.8fr) minmax(90px,0.8fr) minmax(50px,0.4fr)',
                                        }}
                                    >
                                        <span>{resultDateTimeLabel(result.createdAt)}</span>
                                        <span>{result.resultLabel}</span>
                                        <span>合計 {result.totalScore}</span>
                                        <span>恐怖 {result.fearScore}</span>
                                        <span>回避 {result.avoidScore}</span>
                                        <DeleteResultButton testType="lsas" resultId={result.id} />
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
