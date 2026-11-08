import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    ArrowUpLeft,
    CalendarDays,
    ChevronDown,
    CircleUserRound,
    Download,
    FileText,
    LogOut,
    Search,
    Users,
    CarFront,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Person = {
    id: number;
    name: string;
    phone: string | null;
    photo: string | null;
    active: boolean;
};
type Item = {
    id: number;
    membership_id: number;
    status: string;
    created_at: string;
    summary: string | null;
    source_text: string | null;
};
type Props = {
    tenant: { id: number; name: string };
    workspaces: { id: number; name: string }[];
    people: Person[];
    selectedEmployee: number | null;
    profile: boolean;
    period: { from: string; to: string };
    range: string;
    summary: {
        reports: number;
        contributors: number;
        processing: number;
        failed: number;
    };
    reports: {
        data: Item[];
        total: number;
        from: number | null;
        to: number | null;
        links: { url: string | null; label: string; active: boolean }[];
    };
    series: { day: string; total: number }[];
    monthly: boolean;
    aiMode: string;
};
const labels: Record<string, string> = {
    submitted: 'تم الاستلام',
    processing: 'جارٍ التحويل',
    ready: 'جاهز',
    failed: 'تعذّر التحويل',
};
const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const time = new Intl.DateTimeFormat('ar-AE', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
});
function Avatar({
    person,
    large = false,
}: {
    person?: Person;
    large?: boolean;
}) {
    return (
        <span
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400 ring-2 ring-white ${large ? 'h-24 w-24' : 'h-12 w-12'}`}
        >
            {person?.photo ? (
                <img
                    src={person.photo}
                    alt={`صورة ${person.name}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                <CircleUserRound size={large ? 58 : 32} />
            )}
        </span>
    );
}
export default function Overview({
    tenant,
    workspaces,
    people,
    selectedEmployee,
    profile,
    period,
    range,
    summary,
    reports,
    series,
    monthly,
    aiMode,
}: Props) {
    const selected = people.find((person) => person.id === selectedEmployee);
    const base = `/tenants/${tenant.id}/reports`;
    const endpoint =
        profile && selected
            ? `/tenants/${tenant.id}/employees/${selected.id}/reports`
            : base;
    const form = useForm({
        range,
        employee: selectedEmployee ? String(selectedEmployee) : '',
        from: period.from,
        to: period.to,
    });
    const [search, setSearch] = useState('');
    const matches = people.filter((person) =>
        `${person.name} ${person.phone ?? ''}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
    );
    const visit = (nextRange: string, employee: string) =>
        router.get(
            endpoint,
            {
                range: nextRange,
                employee,
                ...(nextRange === 'custom'
                    ? { from: form.data.from, to: form.data.to }
                    : {}),
            },
            { preserveScroll: true },
        );
    const refreshing = useRef(false);
    useEffect(() => {
        const timer = window.setInterval(
            () => {
                if (
                    document.visibilityState === 'visible' &&
                    !refreshing.current
                )
                    router.reload({
                        only: [
                            'reports',
                            'summary',
                            'series',
                            'period',
                            'monthly',
                        ],
                        onStart: () => {
                            refreshing.current = true;
                        },
                        onFinish: () => {
                            refreshing.current = false;
                        },
                    });
            },
            summary.processing > 0 ? 10000 : 30000,
        );
        return () => window.clearInterval(timer);
    }, [summary.processing]);
    const groups = new Map<string, Item[]>();
    for (const item of reports.data) {
        const day = date.format(new Date(item.created_at));
        groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    const max = Math.max(1, ...series.map((item) => item.total));
    const points = series
        .map(
            (item, index) =>
                `${20 + (720 * index) / Math.max(1, series.length - 1)},${150 - (120 * item.total) / max}`,
        )
        .join(' ');
    const exportQuery = new URLSearchParams({
        ...period,
        ...(selectedEmployee ? { employee: String(selectedEmployee) } : {}),
    });
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface manager-surface mx-auto min-h-svh w-full max-w-6xl space-y-5 p-4 sm:p-6"
        >
            <Head
                title={profile && selected ? selected.name : 'تقارير الفريق'}
            />
            <header className="manager-hero flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    {profile ? (
                        <Avatar person={selected} large />
                    ) : (
                        <FileText size={38} className="text-orange-300" />
                    )}
                    <div>
                        <p className="text-sm text-slate-300">{tenant.name}</p>
                        <h1 className="mt-1 text-2xl font-bold">
                            {profile && selected
                                ? selected.name
                                : 'تقارير الفريق'}
                        </h1>
                        {profile && selected?.phone && (
                            <p
                                dir="ltr"
                                className="mt-2 text-start text-slate-300"
                            >
                                {selected.phone}
                            </p>
                        )}
                    </div>
                </div>
                <nav
                    className="flex flex-wrap items-center gap-2"
                    aria-label="لوحة المدير"
                >
                    {profile && (
                        <Link
                            href={base}
                            className="rounded-xl border border-white/30 px-4 py-3"
                        >
                            كل الموظفين
                        </Link>
                    )}
                    <Link
                        href={`/tenants/${tenant.id}/team`}
                        className="flex items-center gap-2 rounded-xl border border-white/30 px-4 py-3"
                    >
                        <Users size={20} />
                        الفريق
                    </Link>
                    <Link
                        href={`/tenants/${tenant.id}/vehicles`}
                        aria-label="السيارات"
                        className="rounded-xl border border-white/30 p-3"
                    >
                        <CarFront size={21} />
                    </Link>
                    <button
                        aria-label="تسجيل الخروج"
                        className="rounded-xl border border-white/30 p-3"
                        onClick={() => router.post('/logout')}
                    >
                        <LogOut size={21} />
                    </button>
                </nav>
            </header>
            {workspaces.length > 1 && (
                <label className="block text-sm">
                    المؤسسة
                    <select
                        className="mx-3 rounded-xl border bg-white p-2"
                        value={tenant.id}
                        onChange={(event) =>
                            router.get(`/tenants/${event.target.value}/reports`)
                        }
                    >
                        {workspaces.map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                                {workspace.name}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {aiMode !== 'openai' && (
                <p className="rounded-2xl bg-amber-50 p-3 text-amber-900">
                    وضع تجريبي؛ لا يُحوّل الصوت فعليًا.
                </p>
            )}
            <section className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-3xl border border-orange-100 bg-white p-5 shadow-sm">
                    <div>
                        <p className="text-sm text-slate-500">
                            التقارير المرسلة
                        </p>
                        <strong className="mt-1 block text-4xl text-orange-600">
                            {summary.reports}
                        </strong>
                    </div>
                    <FileText size={34} className="text-orange-400" />
                </div>
                <div className="flex items-center justify-between rounded-3xl border border-white bg-white/80 p-5 shadow-sm">
                    <div>
                        <p className="text-sm text-slate-500">
                            {selected ? 'الموظف' : 'موظفون أرسلوا تقارير'}
                        </p>
                        <strong className="mt-1 block text-2xl text-slate-800">
                            {selected ? selected.name : summary.contributors}
                        </strong>
                    </div>
                    {selected ? (
                        <Avatar person={selected} />
                    ) : (
                        <Users size={34} className="text-slate-400" />
                    )}
                </div>
            </section>
            <section className="space-y-4 rounded-3xl border border-white bg-white/85 p-4 shadow-sm">
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.get(endpoint, { preserveScroll: true });
                    }}
                >
                    <label className="min-w-40 flex-1 text-sm">
                        الفترة
                        <select
                            aria-label="الفترة"
                            className="mt-1 w-full rounded-xl border bg-white p-3"
                            value={form.data.range}
                            onChange={(event) => {
                                form.setData('range', event.target.value);
                                if (event.target.value !== 'custom')
                                    visit(
                                        event.target.value,
                                        form.data.employee,
                                    );
                            }}
                        >
                            <option value="today">اليوم</option>
                            <option value="yesterday">أمس</option>
                            <option value="7">آخر 7 أيام</option>
                            <option value="30">آخر 30 يومًا</option>
                            <option value="month">هذا الشهر</option>
                            <option value="all">كل التقارير</option>
                            <option value="custom">من تاريخ إلى تاريخ</option>
                        </select>
                    </label>
                    {!profile && (
                        <label className="min-w-44 flex-1 text-sm">
                            الموظف
                            <select
                                aria-label="الموظف"
                                className="mt-1 w-full rounded-xl border bg-white p-3"
                                value={form.data.employee}
                                onChange={(event) =>
                                    visit(form.data.range, event.target.value)
                                }
                            >
                                <option value="">كل الموظفين</option>
                                {people.map((person) => (
                                    <option key={person.id} value={person.id}>
                                        {person.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {form.data.range === 'custom' && (
                        <>
                            <label className="text-sm">
                                من
                                <input
                                    required
                                    type="date"
                                    className="mt-1 block rounded-xl border p-3"
                                    value={form.data.from}
                                    onChange={(event) =>
                                        form.setData('from', event.target.value)
                                    }
                                />
                            </label>
                            <label className="text-sm">
                                إلى
                                <input
                                    required
                                    type="date"
                                    className="mt-1 block rounded-xl border p-3"
                                    value={form.data.to}
                                    onChange={(event) =>
                                        form.setData('to', event.target.value)
                                    }
                                />
                            </label>
                            <button
                                disabled={form.processing}
                                className="rounded-xl bg-orange-500 px-5 py-3 text-white"
                            >
                                عرض
                            </button>
                        </>
                    )}
                    <a
                        aria-label="تصدير تقارير الفترة"
                        href={`${base}/export?${exportQuery}`}
                        className="rounded-xl border p-3"
                    >
                        <Download size={22} />
                    </a>
                    {Object.keys(form.errors).length > 0 && (
                        <p role="alert" className="w-full text-sm text-red-700">
                            راجع الفترة: تاريخ النهاية بعد البداية، والفترة
                            المخصصة حتى 366 يومًا.
                        </p>
                    )}
                </form>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <span>
                        {period.from} — {period.to} · توقيت دبي
                    </span>
                    <span>تظهر التقارير فور الإرسال، دون موافقة.</span>
                </div>
                {!profile && (
                    <>
                        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 p-3">
                            <Search size={20} className="text-slate-400" />
                            <input
                                aria-label="بحث عن موظف بالاسم أو الهاتف"
                                placeholder="ابحث عن موظف بالاسم أو الهاتف"
                                className="min-w-0 flex-1 bg-transparent outline-none"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                            />
                        </label>
                        {search.trim() && (
                            <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                                {matches.length ? (
                                    matches.map((person) => (
                                        <Link
                                            key={person.id}
                                            href={`/tenants/${tenant.id}/employees/${person.id}/reports`}
                                            className="flex items-center gap-3 rounded-2xl border p-3"
                                        >
                                            <Avatar person={person} />
                                            <span className="min-w-0 flex-1">
                                                <strong className="block truncate">
                                                    {person.name}
                                                </strong>
                                                <span
                                                    dir="ltr"
                                                    className="block text-start text-xs text-slate-500"
                                                >
                                                    {person.phone}
                                                </span>
                                            </span>
                                            <ArrowUpLeft size={19} />
                                        </Link>
                                    ))
                                ) : (
                                    <p className="p-3 text-sm text-slate-500">
                                        لا يوجد موظف بهذا الاسم أو الهاتف.
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </section>
            {(profile || selectedEmployee !== null || range !== 'today') && (
                <details
                    open={profile || selectedEmployee !== null}
                    className="rounded-3xl border border-white bg-white/85 p-5 shadow-sm"
                >
                    <summary className="cursor-pointer font-bold">
                        {monthly
                            ? 'عدد التقارير حسب الشهر'
                            : 'عدد التقارير حسب اليوم'}
                    </summary>
                    <svg
                        role="img"
                        aria-label={
                            monthly
                                ? 'رسم عدد التقارير الشهري'
                                : 'رسم عدد التقارير اليومي'
                        }
                        viewBox="0 0 760 180"
                        className="mt-4 w-full"
                    >
                        <line
                            x1="20"
                            y1="150"
                            x2="740"
                            y2="150"
                            stroke="#cbd5e1"
                        />
                        <text x="5" y="25" fontSize="12" fill="#64748b">
                            {max}
                        </text>
                        {series.length > 1 && (
                            <>
                                <polygon
                                    points={`20,150 ${points} 740,150`}
                                    fill="#fff0de"
                                />
                                <polyline
                                    points={points}
                                    fill="none"
                                    stroke="#f97316"
                                    strokeWidth="3"
                                />
                            </>
                        )}
                        {series.length <= 31 &&
                            series.map((point, index) => (
                                <circle
                                    key={point.day}
                                    cx={
                                        20 +
                                        (720 * index) /
                                            Math.max(1, series.length - 1)
                                    }
                                    cy={150 - (120 * point.total) / max}
                                    r="4"
                                    fill="#f97316"
                                >
                                    <title>
                                        {point.day}: {point.total}
                                    </title>
                                </circle>
                            ))}
                    </svg>
                    <p className="text-xs text-slate-500">
                        عدد التقارير لا يثبت الإنتاجية أو إنجاز الأعمال.
                    </p>
                    <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-slate-500">
                            الأعداد حسب التاريخ
                        </summary>
                        <dl className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-auto sm:grid-cols-4">
                            {series.map((point) => (
                                <div
                                    key={point.day}
                                    className="rounded-lg bg-slate-50 p-2"
                                >
                                    <dt>{point.day}</dt>
                                    <dd className="font-bold">{point.total}</dd>
                                </div>
                            ))}
                        </dl>
                    </details>
                </details>
            )}
            <section aria-label="التقارير" className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-bold">
                        {selected ? `تقارير ${selected.name}` : 'كل التقارير'}
                        {range === 'today' ? ' · اليوم' : ''}
                    </h2>
                    {summary.processing > 0 && (
                        <span className="text-xs text-orange-700">
                            جارٍ تحويل {summary.processing} تسجيل
                        </span>
                    )}
                </div>
                {reports.data.length === 0 && (
                    <p className="rounded-3xl border border-dashed bg-white/60 p-10 text-center text-slate-500">
                        لا توجد تقارير في هذه الفترة.
                    </p>
                )}
                {[...groups].map(([day, items], index) => (
                    <details
                        key={day}
                        open={index === 0}
                        className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-sm"
                    >
                        <summary className="flex cursor-pointer list-none items-center gap-3 bg-slate-800 px-5 py-4 text-white">
                            <CalendarDays size={20} />
                            <strong className="flex-1">{day}</strong>
                            <ChevronDown size={18} />
                        </summary>
                        <div className="divide-y divide-slate-100">
                            {items.map((item) => {
                                const person = people.find(
                                    (member) =>
                                        member.id === item.membership_id,
                                );
                                return (
                                    <article
                                        key={item.id}
                                        className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap"
                                    >
                                        <Link
                                            aria-label={`تقارير ${person?.name ?? 'الموظف'}`}
                                            href={`/tenants/${tenant.id}/employees/${item.membership_id}/reports`}
                                            className="flex w-32 shrink-0 items-center gap-3 sm:w-40"
                                        >
                                            <Avatar person={person} />
                                            <strong className="min-w-0 truncate text-sm">
                                                {person?.name ?? 'موظف'}
                                            </strong>
                                        </Link>
                                        <Link
                                            href={`${base}/${item.id}`}
                                            className="order-last min-w-0 flex-1 basis-full sm:order-none sm:basis-auto"
                                        >
                                            <p
                                                dir="auto"
                                                className="line-clamp-2 text-sm leading-relaxed"
                                            >
                                                {item.summary ||
                                                    item.source_text ||
                                                    labels[item.status]}
                                            </p>
                                            <span className="mt-1 block text-xs text-slate-400">
                                                #{item.id} ·{' '}
                                                {labels[item.status]}
                                            </span>
                                        </Link>
                                        <time
                                            dateTime={item.created_at}
                                            className="text-xs whitespace-nowrap text-slate-500"
                                        >
                                            {time.format(
                                                new Date(item.created_at),
                                            )}
                                        </time>
                                        <Link
                                            aria-label={`فتح التقرير ${item.id}`}
                                            href={`${base}/${item.id}`}
                                            className="rounded-full bg-orange-50 p-2 text-orange-600"
                                        >
                                            <ArrowUpLeft size={20} />
                                        </Link>
                                    </article>
                                );
                            })}
                        </div>
                    </details>
                ))}
                {reports.total > 0 && (
                    <p className="text-center text-xs text-slate-500">
                        {reports.from}–{reports.to} من {reports.total}
                    </p>
                )}
                {reports.links.length > 3 && (
                    <nav
                        aria-label="صفحات التقارير"
                        className="flex flex-wrap justify-center gap-2"
                    >
                        {reports.links.map((link, index) =>
                            link.url ? (
                                <Link
                                    key={index}
                                    href={link.url}
                                    className={`rounded-xl border px-4 py-2 ${link.active ? 'bg-slate-800 text-white' : 'bg-white'}`}
                                >
                                    {index === 0
                                        ? 'السابق'
                                        : index === reports.links.length - 1
                                          ? 'التالي'
                                          : link.label}
                                </Link>
                            ) : null,
                        )}
                    </nav>
                )}
            </section>
        </main>
    );
}
