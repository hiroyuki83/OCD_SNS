type TrendSeries = {
    label: string;
    color: string;
    values: number[];
};

export type AssessmentBand = {
    label: string;
    min: number;
    max: number;
    fill: string;
};

export type AssessmentProfileGroup = {
    title: string;
    color?: string;
    items: Array<{
        label: string;
        value: number;
        max: number;
    }>;
};

type SummaryItem = {
    label: string;
    value: number;
    max: number;
};

export default function AssessmentOverview({
    title,
    subtitle,
    labels,
    trendSeries,
    maxScore,
    summaryItems,
    statusLabel,
    deltaLabel,
    bands = [],
    profileGroups,
}: {
    title: string;
    subtitle?: string;
    labels: string[];
    trendSeries: TrendSeries[];
    maxScore: number;
    summaryItems: SummaryItem[];
    statusLabel?: string;
    deltaLabel?: string;
    bands?: AssessmentBand[];
    profileGroups: AssessmentProfileGroup[];
}) {
    if (labels.length === 0 || trendSeries.length === 0) return null;

    const width = Math.max(720, 180 + Math.max(0, labels.length - 1) * 105);
    const height = 260;
    const top = 30;
    const bottom = 42;
    const left = 44;
    const right = bands.length > 0 ? 118 : 28;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const xAt = (index: number) =>
        labels.length === 1 ? left + plotWidth / 2 : left + (index * plotWidth) / (labels.length - 1);
    const yAt = (value: number) => top + ((maxScore - value) / maxScore) * plotHeight;

    const yTicks = Array.from({ length: 5 }, (_, index) => {
        const value = maxScore - (index * maxScore) / 4;
        return { value, y: yAt(value) };
    });

    const latestSummary = summaryItems[0];

    return (
        <section className="border border-border rounded-3xl bg-white overflow-hidden">
            <div className="p-5 md:p-6 space-y-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="text-xl font-bold text-zinc-900">{title}</div>
                        {subtitle && <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {summaryItems.map((item) => (
                            <div
                                key={item.label}
                                className="min-w-32 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                            >
                                <div className="text-[11px] text-zinc-500">{item.label}</div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-3xl font-bold text-zinc-900">{item.value}</span>
                                    <span className="text-sm text-zinc-500">/ {item.max}</span>
                                </div>
                            </div>
                        ))}

                        {statusLabel && (
                            <div className="flex min-w-28 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-800">
                                {statusLabel}
                            </div>
                        )}

                        {deltaLabel && (
                            <div className="min-w-28 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                                <div className="text-[11px] text-zinc-500">前回比</div>
                                <div className="mt-1 text-lg font-bold text-zinc-800">{deltaLabel}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-bold text-zinc-800">スコアの推移</div>
                        {trendSeries.length > 1 && (
                            <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                                {trendSeries.map((series) => (
                                    <div key={series.label} className="flex items-center gap-1.5">
                                        <span
                                            className="h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: series.color }}
                                            aria-hidden="true"
                                        />
                                        <span>{series.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="overflow-x-auto pb-1">
                        <div style={{ minWidth: `${width}px` }}>
                            <svg
                                viewBox={`0 0 ${width} ${height}`}
                                className="h-64 w-full"
                                role="img"
                                aria-label={`${title}のスコア推移`}
                            >
                                {bands.map((band) => {
                                    const yTop = yAt(Math.min(maxScore, band.max));
                                    const yBottom = yAt(Math.max(0, band.min));
                                    return (
                                        <rect
                                            key={`${band.label}-${band.min}-${band.max}`}
                                            x={left}
                                            y={yTop}
                                            width={plotWidth}
                                            height={Math.max(0, yBottom - yTop)}
                                            fill={band.fill}
                                        />
                                    );
                                })}

                                <g stroke="#e4e4e7" strokeWidth="1">
                                    {yTicks.map((tick) => (
                                        <line
                                            key={`grid-${tick.value}`}
                                            x1={left}
                                            y1={tick.y}
                                            x2={left + plotWidth}
                                            y2={tick.y}
                                        />
                                    ))}
                                </g>

                                <g fill="#71717a" fontSize="11" textAnchor="end">
                                    {yTicks.map((tick) => (
                                        <text key={`tick-${tick.value}`} x={left - 8} y={tick.y + 4}>
                                            {Math.round(tick.value)}
                                        </text>
                                    ))}
                                </g>

                                {bands.map((band) => {
                                    if (!band.label) return null;
                                    const yTop = yAt(Math.min(maxScore, band.max));
                                    const yBottom = yAt(Math.max(0, band.min));
                                    return (
                                        <text
                                            key={`band-label-${band.label}`}
                                            x={left + plotWidth + 10}
                                            y={(yTop + yBottom) / 2 + 4}
                                            fill="#52525b"
                                            fontSize="10"
                                        >
                                            {band.label}
                                        </text>
                                    );
                                })}

                                {trendSeries.map((series, seriesIndex) => {
                                    const points = series.values.map((value, index) => ({
                                        x: xAt(index),
                                        y: yAt(value),
                                        value,
                                    }));
                                    const path = points
                                        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
                                        .join(' ');

                                    return (
                                        <g key={series.label}>
                                            <path
                                                d={path}
                                                fill="none"
                                                stroke={series.color}
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            {points.map((point, index) => (
                                                <g key={`${series.label}-${index}`}>
                                                    <circle
                                                        cx={point.x}
                                                        cy={point.y}
                                                        r="4.5"
                                                        fill="#ffffff"
                                                        stroke={series.color}
                                                        strokeWidth="2.5"
                                                    >
                                                        <title>
                                                            {labels[index]} {series.label}: {point.value}
                                                        </title>
                                                    </circle>
                                                    <text
                                                        x={point.x}
                                                        y={point.y + (seriesIndex % 2 === 0 ? -10 : 16)}
                                                        textAnchor="middle"
                                                        fill={series.color}
                                                        fontSize="10"
                                                        fontWeight="700"
                                                    >
                                                        {point.value}
                                                    </text>
                                                </g>
                                            ))}
                                        </g>
                                    );
                                })}

                                <g fill="#71717a" fontSize="10" textAnchor="middle">
                                    {labels.map((label, index) => (
                                        <text key={`${label}-${index}`} x={xAt(index)} y={height - 12}>
                                            {label}
                                        </text>
                                    ))}
                                </g>
                            </svg>
                        </div>
                    </div>

                    {labels.length > 7 && (
                        <div className="mt-1 text-[11px] text-zinc-500">
                            横スクロールで過去のスコアを確認できます。
                        </div>
                    )}

                    {bands.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {bands
                                .filter((band) => band.label)
                                .map((band) => (
                                    <div
                                        key={`legend-${band.label}`}
                                        className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-700"
                                        style={{ backgroundColor: band.fill }}
                                    >
                                        {band.label}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-zinc-100 pt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-zinc-800">直近の下位尺度</div>
                        {latestSummary && (
                            <div className="text-[11px] text-zinc-500">
                                最新結果のプロフィール
                            </div>
                        )}
                    </div>

                    <div className={profileGroups.length > 1 ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
                        {profileGroups.map((group, groupIndex) => {
                            const color = group.color ?? (groupIndex === 0 ? '#0ea5e9' : '#14b8a6');
                            return (
                                <div key={group.title} className="rounded-2xl bg-zinc-50 p-4">
                                    <div className="mb-3 text-xs font-bold text-zinc-700">{group.title}</div>
                                    <div className="space-y-3">
                                        {group.items.map((item) => {
                                            const percent =
                                                item.max > 0
                                                    ? Math.max(0, Math.min(100, (item.value / item.max) * 100))
                                                    : 0;
                                            return (
                                                <div key={item.label}>
                                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-zinc-700">{item.label}</span>
                                                        <span className="font-bold text-zinc-800">
                                                            {item.value} / {item.max}
                                                        </span>
                                                    </div>
                                                    <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${percent}%`,
                                                                backgroundColor: color,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
