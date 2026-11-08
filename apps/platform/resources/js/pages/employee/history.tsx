import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowRight, CalendarDays, Search } from 'lucide-react';
import EmployeeActivity from '@/components/employee-activity';
import type { DayPages } from '@/components/report-day-accordion';
export default function History({
    period,
    days,
}: {
    period: { from: string; to: string };
    days: DayPages;
}) {
    const form = useForm({ from: period.from, to: period.to });
    const quick = (count: number) => {
        const today = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dubai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(new Date());
        const first = new Date(today + 'T12:00:00Z');
        first.setUTCDate(first.getUTCDate() - count + 1);
        router.get('/employee/history', {
            from: first.toISOString().slice(0, 10),
            to: today,
        });
    };
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface employee-surface min-h-svh space-y-6 p-5"
        >
            <Head title="سجل تقاريري" />
            <header className="flex items-center justify-between">
                <Link
                    href="/employee"
                    aria-label="العودة لحسابي"
                    className="workforce-icon"
                >
                    <ArrowRight />
                </Link>
                <CalendarDays className="text-orange-500" size={30} />
            </header>
            <form
                className="space-y-4 rounded-3xl bg-white/80 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.get('/employee/history');
                }}
            >
                <div className="grid grid-cols-2 gap-3">
                    <input
                        aria-label="بداية الفترة بتوقيت دبي"
                        type="date"
                        className="w-full min-w-0 rounded-xl border bg-white p-3 text-sm"
                        value={form.data.from}
                        onChange={(event) =>
                            form.setData('from', event.target.value)
                        }
                    />
                    <input
                        aria-label="نهاية الفترة بتوقيت دبي"
                        type="date"
                        className="w-full min-w-0 rounded-xl border bg-white p-3 text-sm"
                        value={form.data.to}
                        onChange={(event) =>
                            form.setData('to', event.target.value)
                        }
                    />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-3">
                        {[7, 30, 90].map((count) => (
                            <button
                                key={count}
                                type="button"
                                aria-label={`آخر ${count} يومًا`}
                                className="workforce-icon font-bold tabular-nums"
                                onClick={() => quick(count)}
                            >
                                {count}
                            </button>
                        ))}
                    </div>
                    <button
                        aria-label="عرض تقاريري في الفترة المختارة"
                        className="workforce-icon text-orange-600"
                        disabled={form.processing}
                    >
                        <Search />
                    </button>
                </div>
                {Object.values(form.errors).length > 0 && (
                    <p role="alert" className="text-sm text-red-700">
                        {Object.values(form.errors).join(' ')}
                    </p>
                )}
            </form>
            <EmployeeActivity
                key={period.from + period.to}
                days={days}
                endpoint={`/employee/report-days?${new URLSearchParams(period)}`}
            />
        </main>
    );
}
