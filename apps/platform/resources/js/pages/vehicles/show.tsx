import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { useUiLocale } from '@/hooks/use-ui-locale';
import { Head, Link } from '@inertiajs/react';
import { CarFront, CircleUserRound } from 'lucide-react';
import ReportDayAccordion from '@/components/report-day-accordion';
import type { DayPages } from '@/components/report-day-accordion';

export default function Vehicle({
    tenant,
    vehicle,
    contributors,
    counts,
    total,
    days,
}: {
    tenant: { id: number; name: string };
    vehicle: { id: number; plate: string };
    contributors: {
        id: number;
        name: string;
        photo: string | null;
        active: boolean;
    }[];
    counts: Record<string, number>;
    total: number;
    days: DayPages;
}) {
    const { t, locale, direction } = useUiLocale();

    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh max-w-6xl space-y-7 bg-slate-50 p-5 text-slate-900"
        >
            <Head title={`${t('السيارة')} ${vehicle.plate}`} />
            <header className="rounded-3xl bg-gradient-to-bl from-slate-950 to-teal-900 p-8 text-white">
                <ManagerLanguageSwitch className="bg-white text-slate-700" />

                <Link
                    href={`/tenants/${tenant.id}/vehicles`}
                    className="text-teal-100 underline"
                >
                    {' '}
                    {t('كل السيارات')}{' '}
                </Link>
                <div className="mt-6 flex items-center gap-4">
                    <CarFront size={48} />
                    <h1 dir="auto" className="text-3xl font-bold">
                        {vehicle.plate}
                    </h1>
                </div>
                <p className="mt-4 text-teal-100">
                    {contributors.length} {t('موظفين شاركوا بتقارير ·')} {total}{' '}
                    {t('تقارير عبر كامل السجل')}{' '}
                </p>
            </header>
            <section>
                <h2 className="mb-4 text-xl font-bold">
                    {' '}
                    {t('أصحاب التقارير المرتبطة بهذه السيارة')}{' '}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {contributors.map((person) => (
                        <Link
                            key={person.id}
                            href={`/tenants/${tenant.id}/employees/${person.id}/reports`}
                            className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-5 shadow-sm"
                        >
                            {person.photo ? (
                                <img
                                    src={person.photo}
                                    alt={`${t('صورة')} ${person.name}`}
                                    className="h-20 w-20 rounded-full object-cover ring-4 ring-teal-50"
                                />
                            ) : (
                                <CircleUserRound
                                    size={72}
                                    className="text-teal-700"
                                />
                            )}
                            <h3 className="font-bold">{person.name}</h3>
                            <p className="text-sm text-slate-500">
                                {counts[person.id]}{' '}
                                {t('تقارير · عرض سجل الموظف')}{' '}
                            </p>
                        </Link>
                    ))}
                </div>
            </section>
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                {' '}
                {t(
                    'الربط يبين صاحب التقرير، ولا يثبت حضورًا أو إنجازًا فعليًا. راجع الصوت والأدلة قبل اعتماد العمل.',
                )}{' '}
            </p>
            <section className="space-y-4">
                <h2 className="text-xl font-bold">{t('خط العمل الزمني')}</h2>
                <ReportDayAccordion
                    days={days}
                    endpoint={`/tenants/${tenant.id}/reports/by-day?vehicle=${vehicle.id}`}
                    names={Object.fromEntries(
                        contributors.map((person) => [person.id, person.name]),
                    )}
                />
            </section>
        </main>
    );
}
