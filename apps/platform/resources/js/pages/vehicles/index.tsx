import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { useUiLocale } from '@/hooks/use-ui-locale';
import { Head, Link, useForm } from '@inertiajs/react';
import { CarFront, Search, Users } from 'lucide-react';

export default function Vehicles({
    tenant,
    vehicles,
    search,
}: {
    tenant: { id: number; name: string };
    vehicles: {
        data: {
            id: number;
            plate: string;
            report_count: number;
            employee_count: number;
        }[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    search: string;
}) {
    const { t, locale, direction } = useUiLocale();

    const form = useForm({ search });
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh max-w-6xl space-y-6 bg-slate-50 p-5 text-slate-900"
        >
            <Head title={t('سجل السيارات')} />
            <header className="rounded-3xl bg-gradient-to-bl from-slate-950 to-teal-900 p-8 text-white">
                <ManagerLanguageSwitch className="bg-white text-slate-700" />

                <CarFront size={42} className="mb-4 text-teal-300" />
                <h1 className="text-3xl font-bold">
                    {t('كل سيارة، سجل عمل واحد')}
                </h1>
                <p className="mt-3 text-teal-100">
                    {' '}
                    {t(
                        'ابحث باللوحة لتعرف الموظفين الذين أرسلوا تقارير عنها وماذا أبلغوا به.',
                    )}{' '}
                </p>
                <nav className="mt-5 flex gap-4">
                    <Link
                        href={`/tenants/${tenant.id}/team`}
                        className="underline"
                    >
                        {' '}
                        {t('لوحة المدير')}{' '}
                    </Link>
                    <Link
                        href={`/tenants/${tenant.id}/insights`}
                        className="underline"
                    >
                        {' '}
                        {t('المؤشرات')}{' '}
                    </Link>
                </nav>
            </header>
            <form
                className="flex gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.get(`/tenants/${tenant.id}/vehicles`);
                }}
            >
                <input
                    aria-label={t('البحث برقم اللوحة')}
                    value={form.data.search}
                    onChange={(event) =>
                        form.setData('search', event.target.value)
                    }
                    maxLength={80}
                    placeholder={t('الإمارة / الرمز / رقم اللوحة')}
                    className="min-w-0 flex-1 rounded-xl border bg-white p-4"
                />
                <button className="rounded-xl bg-teal-700 px-5 text-white">
                    <Search />
                </button>
            </form>
            <p className="text-sm text-slate-500">
                {' '}
                {t(
                    'تظهر السيارة عند ربط أول تقرير بلوحتها. الموظف قد يعمل على سيارات متعددة.',
                )}{' '}
            </p>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vehicles.data.map((car) => (
                    <Link
                        key={car.id}
                        href={`/tenants/${tenant.id}/vehicles/${car.id}`}
                        className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <CarFront className="text-teal-700" />
                            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">
                                {' '}
                                {t('سجل السيارة')}{' '}
                            </span>
                        </div>
                        <h2
                            dir="auto"
                            className="rounded-xl border-2 border-slate-300 bg-slate-50 p-3 text-center text-xl font-bold"
                        >
                            {car.plate}
                        </h2>
                        <p className="mt-5 flex items-center gap-2 text-slate-600">
                            <Users size={18} />
                            {car.employee_count} {t('موظفين ·')}{' '}
                            {car.report_count} {t('تقارير')}{' '}
                        </p>
                    </Link>
                ))}
            </section>
            {vehicles.data.length === 0 && (
                <p className="rounded-2xl border border-dashed p-8 text-center">
                    {' '}
                    {t(
                        'لا توجد سيارات مطابقة. أضف اللوحة إلى تقرير موظف لبدء سجلها.',
                    )}{' '}
                </p>
            )}
            <nav className="flex gap-2">
                {vehicles.links.map((link, index) =>
                    link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            className={`rounded-lg border p-3 ${link.active ? 'bg-teal-700 text-white' : ''}`}
                        >
                            {index === 0
                                ? t('السابق')
                                : index === vehicles.links.length - 1
                                  ? t('التالي')
                                  : link.label}
                        </Link>
                    ) : null,
                )}
            </nav>
        </main>
    );
}
