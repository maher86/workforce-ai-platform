import {
    ChartColumn,
    ChartNoAxesCombined,
    ChartPie,
    FileText,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useUiLocale } from '@/hooks/use-ui-locale';
import { compactReportSlices, reportSliceColor } from '@/lib/report-chart';
import type { ReportSlice } from '@/lib/report-chart';

// Presentation preference only: tab memory, explicitly scoped to company/profile.
const chartKinds = new Map<string, 'line' | 'pie' | 'bar'>();

export default function ReportActivityChart({
    series,
    distribution,
    employeeShare,
    grain,
    total,
    scope,
}: {
    series: { day: string; total: number }[];
    distribution: ReportSlice[];
    employeeShare: boolean;
    grain: 'hour' | 'day' | 'month';
    total: number;
    scope: string;
}) {
    const { t, locale } = useUiLocale();
    const [kind, setKind] = useState<'line' | 'pie' | 'bar'>(
        () => chartKinds.get(scope) ?? 'line',
    );
    const [width, setWidth] = useState(640);
    const host = useRef<HTMLDivElement>(null);
    const titleId = useId();
    useEffect(() => {
        const element = host.current;
        if (!element) return;
        const measure = () =>
            setWidth(Math.max(180, Math.floor(element.clientWidth)));
        measure();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const slices = compactReportSlices(
        distribution,
        t(employeeShare ? 'موظفون آخرون' : 'بقية الفترات'),
    );
    const title =
        kind === 'pie'
            ? t(
                  employeeShare
                      ? 'توزيع التقارير حسب الموظف'
                      : 'توزيع التقارير حسب التاريخ',
              )
            : t('حركة إرسال التقارير');
    const max = Math.max(1, ...series.map((row) => row.total));
    const step = Math.max(1, Math.ceil(max / 4));
    const ceiling = step * 4;
    const left = 32,
        right = width - 20,
        top = 20,
        bottom = 198;
    const x = (index: number) =>
        series.length === 1
            ? (left + right) / 2
            : kind === 'bar'
              ? left + ((right - left) * (index + 0.5)) / series.length
              : left + ((right - left) * index) / (series.length - 1);
    const y = (value: number) => bottom - ((bottom - top) * value) / ceiling;
    const tickStep = Math.max(
        1,
        Math.ceil(series.length / (width < 380 ? 3 : 6)),
    );
    const circumference = 2 * Math.PI * 74;
    let offset = 0;
    return (
        <section
            className="min-w-0 rounded-3xl border border-white bg-white/90 p-5 shadow-sm"
            aria-label={t('رسم التقارير')}
        >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-bold">{title}</h2>
                    <p className="mt-2 flex items-baseline gap-2">
                        <strong className="text-3xl text-slate-800 tabular-nums">
                            {total}
                        </strong>
                        <span className="text-xs text-slate-500">
                            {t('تقارير مرسلة')}
                        </span>
                    </p>
                </div>
                <div
                    className="flex gap-1"
                    role="group"
                    aria-label={t('نوع الرسم')}
                    dir="ltr"
                >
                    {(
                        [
                            {
                                key: 'line',
                                label: 'رسم خطي',
                                Icon: ChartNoAxesCombined,
                            },
                            { key: 'pie', label: 'رسم دائري', Icon: ChartPie },
                            { key: 'bar', label: 'أعمدة', Icon: ChartColumn },
                        ] as const
                    ).map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={kind === key}
                            aria-label={t(label)}
                            title={t(label)}
                            onClick={() => {
                                chartKinds.set(scope, key);
                                setKind(key);
                            }}
                            className={`grid size-11 place-items-center rounded-xl border ${kind === key ? 'border-orange-100 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Icon size={19} aria-hidden="true" />
                        </button>
                    ))}
                </div>
            </div>
            <div ref={host} className="min-w-0">
                {total === 0 ? (
                    <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500">
                        <FileText
                            size={38}
                            className="text-orange-400"
                            aria-hidden="true"
                        />
                        {t('لا توجد بيانات للرسم في هذه الفترة.')}
                    </div>
                ) : kind === 'pie' ? (
                    <>
                        <svg
                            role="img"
                            aria-labelledby={titleId}
                            viewBox="0 0 220 220"
                            className="mx-auto h-60 w-full max-w-64"
                        >
                            <title id={titleId}>
                                {title}: {total} {t('تقارير')}
                            </title>
                            {slices.map((slice) => {
                                const length =
                                    (slice.total / total) * circumference;
                                const start = offset;
                                offset += length;
                                return (
                                    <circle
                                        key={slice.key}
                                        cx="110"
                                        cy="110"
                                        r="74"
                                        fill="none"
                                        stroke={reportSliceColor(slice.key)}
                                        strokeWidth="28"
                                        strokeDasharray={`${length} ${circumference - length}`}
                                        strokeDashoffset={-start}
                                        transform="rotate(-90 110 110)"
                                    >
                                        <title>
                                            {slice.label}: {slice.total}
                                        </title>
                                    </circle>
                                );
                            })}
                            <text
                                x="110"
                                y="107"
                                textAnchor="middle"
                                className="fill-slate-800 text-2xl font-bold"
                            >
                                {total}
                            </text>
                            <text
                                x="110"
                                y="130"
                                textAnchor="middle"
                                className="fill-slate-500 text-xs"
                            >
                                {t('تقارير مرسلة')}
                            </text>
                        </svg>
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                            {slices.map((slice) => (
                                <li
                                    key={slice.key}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <span
                                        className="size-2.5 shrink-0 rounded-full"
                                        style={{
                                            background: reportSliceColor(
                                                slice.key,
                                            ),
                                        }}
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 flex-1 break-words text-slate-600">
                                        {slice.label}
                                    </span>
                                    <strong className="tabular-nums">
                                        {slice.total}
                                    </strong>
                                    <span className="text-slate-500 tabular-nums">
                                        {new Intl.NumberFormat(
                                            locale === 'en' ? 'en' : 'ar',
                                            {
                                                style: 'percent',
                                                maximumFractionDigits: 1,
                                            },
                                        ).format(slice.total / total)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <svg
                        role="img"
                        aria-labelledby={titleId}
                        viewBox={`0 0 ${width} 250`}
                        width="100%"
                        height="250"
                        style={{ direction: 'ltr' }}
                    >
                        <title id={titleId}>
                            {title}: {total} {t('تقارير')}
                        </title>
                        {[0, 1, 2, 3, 4].map((i) => (
                            <g key={i}>
                                <line
                                    x1={left}
                                    x2={right}
                                    y1={y(i * step)}
                                    y2={y(i * step)}
                                    stroke="#e9eef4"
                                />
                                <text
                                    x={left - 8}
                                    y={y(i * step) + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="#64748b"
                                >
                                    {i * step}
                                </text>
                            </g>
                        ))}
                        {kind === 'line' && series.length > 1 && (
                            <polyline
                                points={series
                                    .map((row, i) => `${x(i)},${y(row.total)}`)
                                    .join(' ')}
                                fill="none"
                                stroke="#e76f16"
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                            />
                        )}
                        {series.map((row, i) => {
                            const barWidth = Math.max(
                                1,
                                ((right - left) / Math.max(1, series.length)) *
                                    0.65,
                            );
                            return (
                                <g key={row.day}>
                                    {kind === 'bar' ? (
                                        <rect
                                            x={x(i) - barWidth / 2}
                                            y={y(row.total)}
                                            width={barWidth}
                                            height={bottom - y(row.total)}
                                            rx={Math.min(5, barWidth / 3)}
                                            fill="#f58220"
                                        >
                                            <title>
                                                {row.day}: {row.total}
                                            </title>
                                        </rect>
                                    ) : (
                                        series.length <= 32 && (
                                            <circle
                                                cx={x(i)}
                                                cy={y(row.total)}
                                                r="3"
                                                fill="#e76f16"
                                            >
                                                <title>
                                                    {row.day}: {row.total}
                                                </title>
                                            </circle>
                                        )
                                    )}
                                    {(i % tickStep === 0 ||
                                        i === series.length - 1) && (
                                        <text
                                            x={x(i)}
                                            y="221"
                                            fontSize="11"
                                            fill="#64748b"
                                            textAnchor={
                                                i === 0
                                                    ? 'start'
                                                    : i === series.length - 1
                                                      ? 'end'
                                                      : 'middle'
                                            }
                                        >
                                            {grain === 'day'
                                                ? row.day.slice(5)
                                                : row.day}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                )}
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
                {kind === 'pie'
                    ? t(
                          employeeShare
                              ? 'حصة كل موظف من تقارير الفترة؛ يشمل الإجمالي التقارير التاريخية للموظفين غير النشطين.'
                              : 'حصة كل فترة من تقارير الموظف المحدد.',
                      )
                    : t(
                          grain === 'hour'
                              ? 'التقارير حسب الساعة · توقيت دبي'
                              : grain === 'month'
                                ? 'التقارير حسب الشهر · توقيت دبي'
                                : 'التقارير حسب اليوم · توقيت دبي',
                      )}
            </p>
            {distribution.filter((row) => row.total > 0).length > 8 &&
                kind === 'pie' && (
                    <p className="mt-1 text-xs text-slate-500">
                        {t('أكبر 7 حصص والبقية مجمّعة؛ الإجمالي لا يتغير.')}
                    </p>
                )}
            <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-600">
                    {t(
                        kind === 'pie'
                            ? 'أعداد الرسم الدائري'
                            : 'الأعداد حسب التاريخ',
                    )}
                </summary>
                <dl className="manager-modal-scroll mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                    {(kind === 'pie'
                        ? distribution
                        : series.map((row) => ({
                              key: row.day,
                              label: row.day,
                              total: row.total,
                          }))
                    ).map((row) => (
                        <div
                            key={row.key}
                            className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-2"
                        >
                            <dt className="min-w-0 text-xs break-words text-slate-600">
                                {row.label}
                            </dt>
                            <dd className="font-semibold tabular-nums">
                                {row.total}
                            </dd>
                        </div>
                    ))}
                </dl>
            </details>
        </section>
    );
}
