import { Link } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    Clock3,
    FileAudio,
    FileText,
    LoaderCircle,
    RefreshCw,
    TriangleAlert,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { DayPages } from '@/components/report-day-accordion';
import VoicePlayback from '@/components/voice-playback';
type ReportItem = {
    id: number;
    status: string;
    created_at: string;
    attachments: { id: number; kind: string }[];
};
function Day({
    day,
    total,
    endpoint,
}: {
    day: string;
    total: number;
    endpoint: string;
}) {
    const [reports, setReports] = useState<ReportItem[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [next, setNext] = useState<number | null>(null);
    const [error, setError] = useState('');
    const lock = useRef(false);
    const load = async (page = 1) => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const response = await fetch(
                `${endpoint}${endpoint.includes('?') ? '&' : '?'}day=${encodeURIComponent(day)}&reports_page=${page}`,
                {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                },
            );
            if (
                !response.ok ||
                !response.headers
                    .get('Content-Type')
                    ?.includes('application/json')
            )
                throw new Error();
            const result = (await response.json()) as {
                data: ReportItem[];
                current_page: number;
                last_page: number;
            };
            setReports((old) =>
                page === 1 ? result.data : [...old, ...result.data],
            );
            setNext(
                result.current_page < result.last_page
                    ? result.current_page + 1
                    : null,
            );
            setLoaded(true);
        } catch {
            setError('تعذّر تحميل التقارير. تحقق من الاتصال وأعد المحاولة.');
        } finally {
            lock.current = false;
            setBusy(false);
        }
    };
    return (
        <details
            className="employee-day group"
            onToggle={(event) => {
                if (event.currentTarget.open && !loaded) void load();
            }}
        >
            <summary className="employee-day-heading">
                <span className="flex items-center gap-3">
                    <CalendarDays size={20} />
                    <time dateTime={day} className="tabular-nums">
                        {day.split('-').reverse().join(' / ')}
                    </time>
                </span>
                <span className="flex items-center gap-3">
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                        {total}
                    </span>
                    <ChevronDown
                        size={19}
                        className="transition-transform group-open:rotate-180"
                    />
                </span>
            </summary>
            <div className="divide-y divide-slate-200/70 px-2 pb-2">
                {reports.map((report) => (
                    <article
                        key={report.id}
                        className="flex flex-wrap items-center gap-2 py-3 sm:flex-nowrap"
                    >
                        <Link
                            href={`/employee/reports/${report.id}`}
                            aria-label={`فتح التقرير ${report.id}`}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl p-1 text-slate-500"
                        >
                            <Clock3 size={13} />
                            <time className="text-xs tabular-nums">
                                {new Date(report.created_at).toLocaleTimeString(
                                    'en-GB',
                                    {
                                        timeZone: 'Asia/Dubai',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: false,
                                    },
                                )}
                            </time>
                        </Link>
                        {report.attachments
                            .filter((item) => item.kind === 'audio')
                            .map((item) => (
                                <VoicePlayback
                                    key={item.id}
                                    src={`/employee/reports/${report.id}/media/${item.id}`}
                                />
                            ))}
                        <Link
                            href={`/employee/reports/${report.id}`}
                            aria-label={`صور وتفاصيل التقرير ${report.id}`}
                            className="flex shrink-0 items-center gap-1"
                        >
                            {report.attachments
                                .filter((item) => item.kind === 'image')
                                .slice(0, 2)
                                .map((item) => (
                                    <img
                                        key={item.id}
                                        src={`/employee/reports/${report.id}/media/${item.id}`}
                                        alt="صورة مرفقة بالتقرير"
                                        loading="lazy"
                                        className="h-11 w-12 rounded-lg object-cover"
                                    />
                                ))}
                            {report.attachments.length === 0 && (
                                <FileText size={25} />
                            )}
                        </Link>
                        <span
                            role="img"
                            aria-label={report.status}
                            className="mr-auto px-1"
                        >
                            {report.status === 'ready' ? (
                                <CheckCircle2
                                    size={16}
                                    className="text-emerald-600"
                                />
                            ) : report.status === 'failed' ? (
                                <TriangleAlert
                                    size={16}
                                    className="text-red-600"
                                />
                            ) : (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin text-orange-500"
                                />
                            )}
                        </span>
                    </article>
                ))}
                <div className="flex items-center justify-center gap-4 py-2">
                    <button
                        type="button"
                        className="workforce-icon h-9 w-9"
                        aria-label="تحديث تقارير اليوم"
                        disabled={busy}
                        onClick={() => void load()}
                    >
                        <RefreshCw
                            size={16}
                            className={busy ? 'animate-spin' : ''}
                        />
                    </button>
                    {next !== null && (
                        <button
                            type="button"
                            className="workforce-icon h-9 w-9"
                            aria-label="تحميل بقية تقارير اليوم"
                            disabled={busy}
                            onClick={() => void load(next)}
                        >
                            <ArrowDown size={17} />
                        </button>
                    )}
                </div>
                {error && (
                    <p
                        role="alert"
                        className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
                    >
                        {error}
                    </p>
                )}
            </div>
        </details>
    );
}
export default function EmployeeActivity({
    days,
    endpoint = '/employee/report-days',
}: {
    days: DayPages;
    endpoint?: string;
}) {
    return (
        <div className="space-y-3">
            {days.data.length === 0 && (
                <div
                    className="flex justify-center rounded-3xl border border-dashed border-slate-300 py-10 text-slate-300"
                    aria-label="لا توجد تقارير بعد"
                >
                    <FileAudio size={45} strokeWidth={1.2} />
                </div>
            )}
            {days.data.map((day) => (
                <Day key={endpoint + day.day} {...day} endpoint={endpoint} />
            ))}
            <nav
                aria-label="صفحات أيام التقارير"
                className="flex justify-center gap-3"
            >
                {days.links.map(
                    (link, index) =>
                        link.url && (
                            <Link
                                key={index}
                                href={link.url}
                                aria-label={
                                    index === 0
                                        ? 'أيام أحدث'
                                        : index === days.links.length - 1
                                          ? 'أيام أقدم'
                                          : `صفحة ${link.label}`
                                }
                                className={`workforce-icon ${link.active ? 'border-orange-400 text-orange-600' : ''}`}
                            >
                                {index === 0 ? (
                                    <ArrowRight size={18} />
                                ) : index === days.links.length - 1 ? (
                                    <ArrowLeft size={18} />
                                ) : (
                                    link.label
                                )}
                            </Link>
                        ),
                )}
            </nav>
        </div>
    );
}
