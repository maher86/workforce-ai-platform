import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { useUiLocale } from '@/hooks/use-ui-locale';
import ServiceInsights from '@/components/service-insights';
import type { ServiceMetrics } from '@/components/service-insights';
import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    BarChart3,
    CalendarDays,
    CarFront,
    CircleUserRound,
    FileText,
    Users,
} from 'lucide-react';
import ReportDayAccordion from '@/components/report-day-accordion';
import type { DayPages } from '@/components/report-day-accordion';

type Person = {
    id: number;
    name: string;
    photo: string | null;
    active: boolean;
};
type Metric = Person & {
    reports: number;
    days: number;
    approved: number;
    changes: number;
    failed: number;
    processing: number;
    approvalRate: number | null;
};
export default function Insights({
    tenant,
    period,
    selectedEmployee,
    people,
    metrics,
    series,
    serviceInsights,
    days,
}: {
    tenant: { id: number; name: string };
    period: { from: string; to: string };
    selectedEmployee: number | null;
    people: Person[];
    metrics: Metric[];
    serviceInsights: ServiceMetrics;
    series: { day: string; total: number }[];
    days: DayPages | null;
}) {
    const { t, locale, direction } = useUiLocale();

    const form = useForm({
        from: period.from,
        to: period.to,
        employee: selectedEmployee ? String(selectedEmployee) : '',
    });
    const total = metrics.reduce((sum, item) => sum + item.reports, 0);
    const failures = metrics.reduce((sum, item) => sum + item.failed, 0);
    const max = Math.max(1, ...series.map((item) => item.total));
    const maxReports = Math.max(1, ...metrics.map((item) => item.reports));
    const points = series
        .map(
            (item, index) =>
                `${20 + (index / Math.max(1, series.length - 1)) * 760},${170 - (item.total / max) * 140}`,
        )
        .join(' ');
    const quick = (count: number) => {
        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
        const start = new Date(today + 'T12:00:00Z');
        start.setUTCDate(start.getUTCDate() - count + 1);
        router.get(`/tenants/${tenant.id}/insights`, {
            from: start.toISOString().slice(0, 10),
            to: today,
            ...(selectedEmployee ? { employee: selectedEmployee } : {}),
        });
    };
    const query = new URLSearchParams({
        ...period,
        ...(selectedEmployee ? { employee: String(selectedEmployee) } : {}),
    });
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh max-w-7xl space-y-6 bg-slate-50 p-5 text-slate-900"
        >
            <Head title={t('مؤشرات التقارير')} />
            <header className="flex flex-wrap items-center justify-between gap-5 rounded-3xl bg-gradient-to-bl from-slate-950 to-teal-900 p-8 text-white">
                <ManagerLanguageSwitch className="border-white/30 text-white" />

                <div>
                    <BarChart3 className="mb-4 text-teal-300" size={36} />
                    <h1 className="text-3xl font-bold">
                        {selectedEmployee
                            ? metrics[0]?.name
                            : t('صورة أوضح لنشاط الفريق')}
                    </h1>
                    <p className="mt-3 text-teal-100">
                        {tenant.name} {t('· مؤشرات التقارير، بتوقيت دبي')}{' '}
                    </p>
                </div>
                <nav className="flex gap-3">
                    <Link
                        href={`/tenants/${tenant.id}/team`}
                        className="rounded-xl border border-white/30 p-3"
                    >
                        {' '}
                        {t('الفريق')}{' '}
                    </Link>
                    <Link
                        href={`/tenants/${tenant.id}/vehicles`}
                        className="flex items-center gap-2 rounded-xl border border-white/30 p-3"
                    >
                        <CarFront /> {t('السيارات')}{' '}
                    </Link>
                </nav>
            </header>
            <form
                className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.get(`/tenants/${tenant.id}/insights`);
                }}
            >
                <label>
                    {' '}
                    {t('من')}{' '}
                    <input
                        type="date"
                        className="mx-2 rounded-lg border p-2"
                        value={form.data.from}
                        onChange={(event) =>
                            form.setData('from', event.target.value)
                        }
                        required
                    />
                </label>
                <label>
                    {' '}
                    {t('إلى')}{' '}
                    <input
                        type="date"
                        className="mx-2 rounded-lg border p-2"
                        value={form.data.to}
                        onChange={(event) =>
                            form.setData('to', event.target.value)
                        }
                        required
                    />
                </label>
                <label>
                    {' '}
                    {t('الموظف')}{' '}
                    <select
                        className="mx-2 max-w-60 rounded-lg border p-2"
                        value={form.data.employee}
                        onChange={(event) =>
                            form.setData('employee', event.target.value)
                        }
                    >
                        <option value="">{t('كل الموظفين')}</option>
                        {people.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.name}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    disabled={form.processing}
                    className="rounded-xl bg-teal-700 px-5 py-3 text-white"
                >
                    {' '}
                    {t('عرض الفترة')}{' '}
                </button>
                <button
                    type="button"
                    className="rounded-xl border p-3"
                    onClick={() => quick(7)}
                >
                    {' '}
                    {t('آخر 7 أيام')}{' '}
                </button>
                <button
                    type="button"
                    className="rounded-xl border p-3"
                    onClick={() => quick(30)}
                >
                    {' '}
                    {t('آخر 30 يومًا')}{' '}
                </button>
                <p className="w-full text-sm text-slate-500">
                    {' '}
                    {t(
                        'اختر أي فترة حتى 366 يومًا. المعدلات تُحسب من البيانات الفعلية فقط.',
                    )}{' '}
                </p>
                {Object.keys(form.errors).length > 0 && (
                    <p role="alert" className="text-red-700">
                        {' '}
                        {t(
                            'راجع التاريخ؛ النهاية بعد البداية والفترة لا تتجاوز 366 يومًا.',
                        )}{' '}
                    </p>
                )}
            </form>
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {[
                    {
                        label: t('التقارير المرسلة'),
                        value: total,
                        icon: FileText,
                    },
                    {
                        label: t('موظفون أرسلوا تقارير'),
                        value: metrics.filter((item) => item.reports > 0)
                            .length,
                        icon: Users,
                    },
                    {
                        label: t('قيد التحويل'),
                        value: metrics.reduce(
                            (sum, item) => sum + item.processing,
                            0,
                        ),
                        icon: FileText,
                    },
                    {
                        label: t('تعذّر معالجتها'),
                        value: failures,
                        icon: CalendarDays,
                    },
                ].map((card) => (
                    <div
                        key={card.label}
                        className="rounded-2xl border bg-white p-5 shadow-sm"
                    >
                        <card.icon className="mb-4 text-teal-700" />
                        <strong className="block text-3xl">{card.value}</strong>
                        <p className="mt-2 text-sm text-slate-500">
                            {card.label}
                        </p>
                    </div>
                ))}
            </section>
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
                {' '}
                {t(
                    'هذه مؤشرات نشاط الإبلاغ ومراجعة التقارير، وليست تقييمًا للإنتاجية أو الحضور. لا تعني كثرة التقارير جودة أعلى أو إنجازًا مؤكدًا.',
                )}{' '}
            </p>
            <ServiceInsights metrics={serviceInsights} total={total} />
            <section className="rounded-2xl border bg-white p-5">
                <h2 className="mb-2 text-xl font-bold">
                    {t('اتجاه إرسال التقارير')}
                </h2>
                <p className="text-sm text-slate-500">
                    {period.from} — {period.to} {t('· أعلى قيمة يومية:')}{' '}
                    {max === 1 && total === 0 ? 0 : max}
                </p>
                <svg
                    role="img"
                    aria-label={t(
                        'اتجاه عدد التقارير اليومي؛ التفاصيل في الجدول التالي',
                    )}
                    viewBox="0 0 800 190"
                    className="mt-3 w-full"
                >
                    <line x1="20" y1="170" x2="780" y2="170" stroke="#cbd5e1" />
                    {series.length > 1 && (
                        <>
                            <polygon
                                points={`20,170 ${points} 780,170`}
                                fill="#ccfbf1"
                            />
                            <polyline
                                points={points}
                                fill="none"
                                stroke="#0f766e"
                                strokeWidth="3"
                                strokeLinejoin="round"
                            />
                        </>
                    )}
                    {series.length === 1 && (
                        <circle
                            cx="400"
                            cy={170 - (series[0].total / max) * 140}
                            r="4"
                            fill="#0f766e"
                        />
                    )}
                </svg>
                <details>
                    <summary className="cursor-pointer text-sm text-teal-800">
                        {' '}
                        {t('جدول الأرقام اليومية')}{' '}
                    </summary>
                    <div className="mt-3 max-h-64 overflow-auto">
                        {series.map((item) => (
                            <p
                                key={item.day}
                                className="flex justify-between border-b p-2"
                            >
                                <span>{item.day}</span>
                                <span>
                                    {item.total} {t('تقارير')}
                                </span>
                            </p>
                        ))}
                    </div>
                </details>
            </section>
            <section className="space-y-4">
                <h2 className="text-xl font-bold">
                    {selectedEmployee
                        ? t('ملف نشاط الموظف في الفترة')
                        : t('مقارنة نشاط الإبلاغ بين الموظفين')}
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {metrics.map((person) => (
                        <Link
                            key={person.id}
                            href={`/tenants/${tenant.id}/insights?${new URLSearchParams({ ...period, employee: String(person.id) })}`}
                            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
                        >
                            <div className="mb-5 flex items-center gap-3">
                                {person.photo ? (
                                    <img
                                        src={person.photo}
                                        alt={`${t('صورة')} ${person.name}`}
                                        className="h-14 w-14 rounded-full object-cover"
                                    />
                                ) : (
                                    <CircleUserRound
                                        size={52}
                                        className="text-teal-700"
                                    />
                                )}
                                <div>
                                    <h3 className="font-bold">{person.name}</h3>
                                    <p className="text-sm text-slate-500">
                                        {person.active
                                            ? t('نشط')
                                            : t('الوصول موقوف')}{' '}
                                        {t('· فتح سجل الأيام')}{' '}
                                    </p>
                                </div>
                            </div>
                            <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-teal-600"
                                    style={{
                                        width: `${(100 * person.reports) / maxReports}%`,
                                    }}
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <p>
                                    <strong className="block text-xl">
                                        {person.reports}
                                    </strong>
                                    <span className="text-xs text-slate-500">
                                        {' '}
                                        {t('تقارير')}{' '}
                                    </span>
                                </p>
                                <p>
                                    <strong className="block text-xl">
                                        {person.days}
                                    </strong>
                                    <span className="text-xs text-slate-500">
                                        {' '}
                                        {t('أيام بها تقارير')}{' '}
                                    </span>
                                </p>
                                <p>
                                    <strong className="block text-xl">
                                        {person.failed}
                                    </strong>
                                    <span className="text-xs text-slate-500">
                                        {' '}
                                        {t('تعذّر معالجتها')}{' '}
                                    </span>
                                </p>
                            </div>
                            <p className="mt-4 text-xs text-slate-500">
                                {person.processing} {t('قيد المعالجة ·')}{' '}
                                {person.failed} {t('تعذّر ·')} {person.changes}{' '}
                                {t('يحتاج تعديلًا')}{' '}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>
            {days && (
                <section className="space-y-4">
                    <h2 className="text-xl font-bold">
                        {' '}
                        {t('تقارير الموظف حسب اليوم')}{' '}
                    </h2>
                    <ReportDayAccordion
                        days={days}
                        endpoint={`/tenants/${tenant.id}/reports/by-day?${query}`}
                        names={Object.fromEntries(
                            people.map((person) => [person.id, person.name]),
                        )}
                    />
                </section>
            )}
        </main>
    );
}
