import { Head, Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { useUiLocale } from '@/hooks/use-ui-locale';

type Props = {
    company: { id: number; name: string };
    reason: string;
    expiresAt: string;
    summary: {
        employees: number;
        reports: number;
        processing: number;
        failed: number;
    };
    failures: {
        id: number;
        status: string;
        failure_code: string | null;
        created_at: string;
    }[];
};
export default function Diagnostics({
    company,
    reason,
    expiresAt,
    summary,
    failures,
}: Props) {
    const { t, locale, direction } = useUiLocale();
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh max-w-5xl space-y-5 p-5"
        >
            <Head title={t('تشخيص تقني')} />
            <header className="manager-hero flex flex-wrap items-center justify-between gap-4">
                <div>
                    <ShieldCheck className="mb-2 text-orange-300" />
                    <h1 className="text-2xl font-bold">{company.name}</h1>
                    <p className="mt-2 text-sm text-slate-300">
                        {t('جلسة دعم تقنية للقراءة فقط')}
                    </p>
                </div>
                <ManagerLanguageSwitch className="border-white/30 text-white" />
            </header>
            <Link
                href="/platform"
                className="inline-block rounded-xl border bg-white px-4 py-3"
            >
                {t('العودة للشركات')}
            </Link>
            <section className="space-y-3 rounded-3xl border bg-white p-5">
                <p>{reason}</p>
                <p className="text-sm text-slate-500">
                    {t('تنتهي الجلسة')}:{' '}
                    {new Date(expiresAt).toLocaleString(
                        locale === 'ar' ? 'ar-AE' : 'en-GB',
                        { timeZone: 'Asia/Dubai' },
                    )}
                </p>
                <p className="text-sm text-slate-500">
                    {t(
                        'لا تظهر تسجيلات الموظفين أو نصوصهم أو صورهم في هذه اللوحة.',
                    )}
                </p>
            </section>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(summary).map(([key, value]) => (
                    <div key={key} className="rounded-2xl border bg-white p-5">
                        <strong className="text-3xl">{value}</strong>
                        <p className="mt-2 text-sm">
                            {t(
                                (
                                    {
                                        employees: 'الموظفون',
                                        reports: 'التقارير',
                                        processing: 'قيد المعالجة',
                                        failed: 'تعذّر التحويل',
                                    } as Record<string, string>
                                )[key],
                            )}
                        </p>
                    </div>
                ))}
            </section>
            <section className="rounded-3xl border bg-white p-5">
                <h2 className="mb-4 font-bold">{t('أحدث الأخطاء التقنية')}</h2>
                {failures.length === 0 ? (
                    <p className="text-slate-500">{t('لا توجد أخطاء')}</p>
                ) : (
                    <ul className="divide-y">
                        {failures.map((item) => (
                            <li
                                key={item.id}
                                className="flex items-center justify-between gap-3 py-3"
                            >
                                <span>#{item.id}</span>
                                <code>{item.failure_code ?? 'UNKNOWN'}</code>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}
