import { Link } from '@inertiajs/react';
import { CalendarDays, ChevronDown, FileText, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';

export type DayPages = {
    data: { day: string; total: number }[];
    links: { url: string | null; label: string; active: boolean }[];
};
type Item = {
    id: number;
    tenant_id: number;
    membership_id: number;
    vehicle_plate: string | null;
    created_at: string;
    status: string;
    review_status: string;
};
const labels: Record<string, string> = {
    submitted: 'تم الاستلام',
    processing: 'تجري المعالجة',
    ready: 'جاهز',
    failed: 'تعذّرت المعالجة',
};

function Day({
    day,
    total,
    endpoint,
    names,
    employee,
}: {
    day: string;
    total: number;
    endpoint: string;
    names: Record<string, string>;
    employee: boolean;
}) {
    const [items, setItems] = useState<Item[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [next, setNext] = useState<number | null>(null);
    const lock = useRef(false);
    const load = async (page = 1) => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.set('day', day);
            url.searchParams.set('reports_page', String(page));
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (
                !response.ok ||
                !response.headers
                    .get('Content-Type')
                    ?.includes('application/json')
            )
                throw new Error();
            const data = (await response.json()) as {
                data: Item[];
                current_page: number;
                last_page: number;
            };
            setItems((old) =>
                page === 1 ? data.data : [...old, ...data.data],
            );
            setNext(
                data.current_page < data.last_page
                    ? data.current_page + 1
                    : null,
            );
            setLoaded(true);
        } catch {
            setError('تعذّر تحميل التقارير. أعد المحاولة.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return (
        <details
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm"
            onToggle={(event) => {
                if (event.currentTarget.open && !loaded) void load();
            }}
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 hover:bg-teal-50 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                    <CalendarDays className="text-teal-700" />
                    <span>
                        <span className="block font-bold">
                            {new Intl.DateTimeFormat('ar-AE', {
                                timeZone: 'Asia/Dubai',
                                dateStyle: 'long',
                            }).format(new Date(day + 'T12:00:00Z'))}
                        </span>
                        <span className="text-sm text-slate-500">
                            {total} تقارير · توقيت دبي
                        </span>
                    </span>
                </span>
                <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-3 border-t p-4">
                <button
                    disabled={busy}
                    onClick={() => void load()}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                    <RefreshCw size={16} />
                    تحديث اليوم
                </button>
                {items.map((report) => (
                    <Link
                        key={report.id}
                        href={
                            employee
                                ? `/employee/reports/${report.id}`
                                : `/tenants/${report.tenant_id}/reports/${report.id}`
                        }
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 transition hover:bg-teal-50"
                    >
                        <span className="flex items-center gap-3">
                            <FileText className="text-teal-700" />
                            <span>
                                <strong className="block">
                                    #{report.id}
                                    {names[report.membership_id]
                                        ? ` · ${names[report.membership_id]}`
                                        : ''}
                                </strong>
                                <span className="text-sm text-slate-500">
                                    {new Intl.DateTimeFormat('ar-AE', {
                                        timeZone: 'Asia/Dubai',
                                        timeStyle: 'short',
                                    }).format(new Date(report.created_at))}
                                    {report.vehicle_plate
                                        ? ` · 🚘 ${report.vehicle_plate}`
                                        : ''}
                                </span>
                            </span>
                        </span>
                        <span className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-white px-3 py-1">
                                {labels[report.status]}
                            </span>
                        </span>
                    </Link>
                ))}
                {busy && <p role="status">جارٍ التحميل…</p>}
                {error && (
                    <p role="alert" className="text-red-700">
                        {error}
                        <button
                            className="mx-3 underline"
                            onClick={() => void load()}
                        >
                            إعادة المحاولة
                        </button>
                    </p>
                )}
                {next !== null && (
                    <button
                        disabled={busy}
                        onClick={() => void load(next)}
                        className="w-full rounded-xl border p-3"
                    >
                        تحميل المزيد من تقارير هذا اليوم
                    </button>
                )}
            </div>
        </details>
    );
}

export default function ReportDayAccordion({
    days,
    endpoint,
    names = {},
    employee = false,
}: {
    days: DayPages;
    endpoint: string;
    names?: Record<string, string>;
    employee?: boolean;
}) {
    return (
        <section className="w-full space-y-3 text-right">
            {days.data.length === 0 && (
                <div className="rounded-2xl border border-dashed p-8 text-center text-slate-500">
                    لا توجد تقارير في هذه الفترة.
                </div>
            )}
            {days.data.map((day) => (
                <Day
                    key={endpoint + day.day}
                    {...day}
                    endpoint={endpoint}
                    names={names}
                    employee={employee}
                />
            ))}
            <nav
                aria-label="صفحات أيام التقارير"
                className="flex flex-wrap gap-2"
            >
                {days.links.map((link, index) =>
                    link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            className={`rounded-lg border px-4 py-2 ${link.active ? 'bg-teal-700 text-white' : ''}`}
                        >
                            {index === 0
                                ? 'السابق'
                                : index === days.links.length - 1
                                  ? 'التالي'
                                  : link.label}
                        </Link>
                    ) : null,
                )}
            </nav>
        </section>
    );
}
