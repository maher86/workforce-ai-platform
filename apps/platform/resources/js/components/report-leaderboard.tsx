import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    FileText,
    Trophy,
    UserRoundMinus,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { useUiLocale } from '@/hooks/use-ui-locale';

export type Participation = {
    ranked: { membership_id: number; reports: number; rank: number }[];
    silent: number[];
    eligible: number;
    distribution: { membership_id: number; reports: number }[];
};
type Person = { id: number; name: string; photo: string | null };

export default function ReportLeaderboard({
    tenant,
    people,
    data,
    range,
    period,
}: {
    tenant: number;
    people: Person[];
    data: Participation;
    range: string;
    period: { from: string; to: string };
}) {
    const { t } = useUiLocale();
    const [silentOpen, setSilentOpen] = useState(false);
    const [all, setAll] = useState(false);
    const byId = new Map(people.map((person) => [person.id, person]));
    const maximum = data.ranked[0]?.reports ?? 1;
    const personLink = (person: Person) =>
        `/tenants/${tenant}/employees/${person.id}/reports`;
    return (
        <section
            className="min-w-0 rounded-3xl border border-white bg-white/90 p-5 shadow-sm"
            aria-label={t('ترتيب إرسال التقارير')}
        >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 font-bold">
                        <Trophy
                            size={21}
                            className="text-orange-500"
                            aria-hidden="true"
                        />
                        {t('الأكثر إرسالًا للتقارير')}
                    </h2>
                    <p className="mt-1 text-xs text-slate-500" dir="ltr">
                        {period.from} — {period.to}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setSilentOpen(!silentOpen)}
                    aria-expanded={silentOpen}
                    aria-controls="report-silent-employees"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-50 px-3 text-sm font-semibold text-amber-900"
                >
                    <UserRoundMinus size={18} aria-hidden="true" />
                    {t('بدون تقارير')}
                    <span className="tabular-nums">{data.silent.length}</span>
                </button>
            </div>
            <nav
                className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-slate-50 p-1"
                aria-label={t('فترة ترتيب التقارير')}
            >
                {[
                    ['today', 'يومي'],
                    ['7', 'أسبوعي'],
                    ['month', 'شهري'],
                ].map(([value, label]) => (
                    <Link
                        key={value}
                        href={`/tenants/${tenant}/reports?range=${value}`}
                        preserveScroll
                        aria-current={range === value ? 'page' : undefined}
                        className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold ${range === value ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
                    >
                        {t(label)}
                    </Link>
                ))}
            </nav>
            {silentOpen && (
                <div
                    id="report-silent-employees"
                    className="mb-4 rounded-2xl border border-orange-100 bg-orange-50/40 p-3"
                >
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                        <Users size={17} aria-hidden="true" />
                        {t('لم يرسلوا خلال الفترة المختارة')}
                    </h3>
                    <div className="manager-modal-scroll grid max-h-64 gap-2 overflow-y-auto">
                        {data.silent.length ? (
                            data.silent.map((id) => {
                                const person = byId.get(id);
                                return (
                                    person && (
                                        <Link
                                            key={id}
                                            href={personLink(person)}
                                            className="flex min-h-11 items-center gap-2 rounded-xl bg-white p-2 text-sm text-slate-700"
                                        >
                                            {person.photo ? (
                                                <img
                                                    src={person.photo}
                                                    alt=""
                                                    loading="lazy"
                                                    className="size-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100">
                                                    {person.name.slice(0, 1)}
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1 break-words">
                                                {person.name}
                                            </span>
                                            <span className="text-slate-500 tabular-nums">
                                                0
                                            </span>
                                        </Link>
                                    )
                                );
                            })
                        ) : (
                            <p className="text-sm text-slate-600">
                                {t(
                                    data.eligible
                                        ? 'أرسل الجميع تقريرًا خلال هذه الفترة.'
                                        : 'لا يوجد موظفون مؤهلون لهذه الفترة.',
                                )}
                            </p>
                        )}
                    </div>
                </div>
            )}
            <ol className="divide-y divide-slate-100">
                {(all ? data.ranked : data.ranked.slice(0, 5)).map((row) => {
                    const person = byId.get(row.membership_id);
                    return (
                        person && (
                            <li key={person.id}>
                                <Link
                                    href={personLink(person)}
                                    className="flex min-h-20 items-center gap-3 py-3"
                                >
                                    <span className="w-5 shrink-0 text-center text-xs text-slate-500 tabular-nums">
                                        {row.rank}
                                    </span>
                                    {person.photo ? (
                                        <img
                                            src={person.photo}
                                            alt=""
                                            loading="lazy"
                                            className="size-11 shrink-0 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span
                                            className={`grid size-11 shrink-0 place-items-center rounded-full font-bold ${row.rank === 1 ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-300' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                            {person.name.slice(0, 1)}
                                        </span>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <strong className="block text-sm break-words">
                                            {person.name}
                                        </strong>
                                        <div
                                            className="mt-2 h-1 max-w-28 overflow-hidden rounded-full bg-slate-100"
                                            aria-hidden="true"
                                        >
                                            <div
                                                className="h-full rounded-full bg-orange-500"
                                                style={{
                                                    width: `${(row.reports / maximum) * 100}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <strong className="block text-xl text-slate-800 tabular-nums">
                                            {row.reports}
                                        </strong>
                                        <span className="text-xs text-slate-500">
                                            {t('تقارير')}
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        )
                    );
                })}
            </ol>
            {data.ranked.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-7 text-center text-sm text-slate-500">
                    <FileText
                        size={30}
                        className="text-orange-400"
                        aria-hidden="true"
                    />
                    {t('لا توجد تقارير للترتيب في هذه الفترة.')}
                </div>
            )}
            {data.ranked.length > 5 && (
                <button
                    type="button"
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-orange-700 hover:bg-orange-50"
                    aria-expanded={all}
                    onClick={() => setAll(!all)}
                >
                    <ChevronDown
                        size={17}
                        className={all ? 'rotate-180' : ''}
                        aria-hidden="true"
                    />
                    {t(all ? 'عرض أقل' : 'عرض جميع الموظفين')}
                </button>
            )}
            <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
                {t('عدد التقارير المرسلة فقط؛ لا يثبت الإنتاجية أو الحضور.')}{' '}
                {t('الموظفون النشطون الحاليون حتى نهاية الفترة:')}{' '}
                <span className="tabular-nums">{data.eligible}</span>
            </p>
        </section>
    );
}
