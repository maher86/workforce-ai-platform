import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { ArrowRight, CarFront, Clock3, Settings2, Trash2 } from 'lucide-react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import ReportTexts from '@/components/report-texts';
import type { TextOutput } from '@/components/report-texts';
import VoicePlayback from '@/components/voice-playback';
import ReportSourceHistory from '@/components/report-source-history';
import type { SourcePages } from '@/components/report-source-history';
import ServiceFactsForm from '@/components/service-facts-form';
import type { ServiceFact, FactHistory } from '@/components/service-facts-form';
import { useUiLocale } from '@/hooks/use-ui-locale';

type Report = {
    id: number;
    tenant_id: number;
    status: string;
    source_text: string | null;
    source_version: number;
    created_at: string;
    deleted_at: string | null;
    failure_code: string | null;
};
type Props = {
    report: Report;
    employeeName: string;
    employeePhone: string | null;
    employeePhotoUrl: string | null;
    employeeProfileUrl: string | null;
    outputs: TextOutput[];
    media: { id: number; kind: string }[];
    sourceChanges: SourcePages;
    currentServiceFact: ServiceFact | null;
    serviceFacts: FactHistory;
    revisions: {
        id: number;
        english_report: string;
        reason: string;
        created_at: string;
    }[];
    aiMode: string;
    canDelete: boolean;
    vehicle: { id: number; plate: string } | null;
};
export default function ShowReport({
    report,
    employeeName,
    employeePhone,
    employeePhotoUrl,
    employeeProfileUrl,
    outputs,
    media,
    sourceChanges,
    currentServiceFact,
    serviceFacts,
    revisions,
    aiMode,
    canDelete,
    vehicle,
}: Props) {
    const { t, locale, direction } = useUiLocale();
    const base = `/tenants/${report.tenant_id}/reports/${report.id}`;
    const car = useForm({ vehicle_plate: vehicle?.plate ?? '' });
    const pending = ['submitted', 'processing'].includes(report.status);
    useEffect(() => {
        if (!pending) return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                router.reload({ only: ['report', 'outputs'] });
        }, 5000);
        return () => window.clearInterval(timer);
    }, [pending]);
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh w-full max-w-5xl space-y-5 p-4 sm:p-6"
        >
            <Head title={`${t('تقرير')} #${report.id}`} />
            <nav className="flex items-center justify-between gap-3">
                <Link
                    href={`/tenants/${report.tenant_id}/reports`}
                    className="flex items-center gap-2 rounded-xl border bg-white p-3"
                >
                    <ArrowRight size={18} />
                    {t('التقارير')}
                </Link>
                <ManagerLanguageSwitch className="bg-white text-slate-700" />
            </nav>
            <header className="manager-hero flex flex-wrap items-center gap-4">
                {employeePhotoUrl && (
                    <img
                        src={employeePhotoUrl}
                        alt={t('صورة الموظف')}
                        className="h-20 w-20 rounded-full object-cover ring-2 ring-white"
                    />
                )}
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold">
                        {employeeProfileUrl ? (
                            <Link href={employeeProfileUrl}>
                                {employeeName}
                            </Link>
                        ) : (
                            employeeName
                        )}
                    </h1>
                    {employeePhone && (
                        <p
                            dir="ltr"
                            className="mt-1 text-start text-sm text-slate-300"
                        >
                            {employeePhone}
                        </p>
                    )}
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
                        <Clock3 size={15} />
                        <time dateTime={report.created_at}>
                            {new Date(report.created_at).toLocaleString(
                                locale === 'ar' ? 'ar-AE' : 'en-GB',
                                { timeZone: 'Asia/Dubai' },
                            )}
                        </time>
                        <span>· #{report.id}</span>
                    </p>
                </div>
                {vehicle && (
                    <Link
                        className="rounded-xl border border-white/30 px-4 py-2"
                        href={`/tenants/${report.tenant_id}/vehicles/${vehicle.id}`}
                    >
                        <CarFront className="inline" size={19} />{' '}
                        {vehicle.plate}
                    </Link>
                )}
            </header>
            {report.deleted_at && (
                <p
                    role="alert"
                    className="rounded-2xl bg-amber-50 p-3 text-amber-900"
                >
                    {t(
                        'حذف الموظف هذا التقرير من قائمته؛ هذه نسخة محفوظة فقط.',
                    )}
                </p>
            )}
            {aiMode !== 'openai' && (
                <p className="rounded-2xl bg-amber-50 p-3 text-amber-900">
                    {t('وضع المحاكاة')}
                </p>
            )}
            {report.status === 'failed' && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-red-800"
                >
                    <span>
                        {t('تعذّر التحويل')} · {report.failure_code}
                    </span>
                    {!report.deleted_at && (
                        <button
                            className="rounded-xl border px-4 py-2"
                            onClick={() => router.post(`${base}/retry`)}
                        >
                            {t('إعادة المحاولة')}
                        </button>
                    )}
                </div>
            )}
            <ReportTexts
                source={report.source_text}
                outputs={outputs}
                pending={pending}
            />
            <section className="min-w-0 space-y-4 rounded-3xl border border-white bg-white/70 p-4">
                {media
                    .filter((item) => item.kind === 'audio')
                    .map((item) => (
                        <VoicePlayback
                            key={item.id}
                            src={`${base}/media/${item.id}`}
                        />
                    ))}
                {media.some((item) => item.kind === 'image') && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {media
                            .filter((item) => item.kind === 'image')
                            .map((item) => (
                                <a
                                    key={item.id}
                                    href={`${base}/media/${item.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <img
                                        src={`${base}/media/${item.id}`}
                                        alt={t('صورة التقرير')}
                                        className="max-h-64 w-full rounded-2xl object-contain"
                                    />
                                </a>
                            ))}
                    </div>
                )}
            </section>
            <details className="rounded-2xl border bg-white/70 p-4">
                <summary className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
                    <Settings2 size={18} />
                    {t('خيارات إضافية')}
                </summary>
                <div className="mt-5 space-y-5">
                    {!report.deleted_at && (
                        <form
                            className="flex flex-wrap items-end gap-3"
                            onSubmit={(event) => {
                                event.preventDefault();
                                car.post(`${base}/vehicle`, {
                                    preserveScroll: true,
                                });
                            }}
                        >
                            <label className="flex-1 text-sm">
                                {t('لوحة السيارة')}
                                <input
                                    maxLength={80}
                                    className="mt-1 w-full rounded-xl border p-3"
                                    value={car.data.vehicle_plate}
                                    onChange={(event) =>
                                        car.setData(
                                            'vehicle_plate',
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                            <button
                                disabled={car.processing}
                                className="rounded-xl border px-4 py-3"
                            >
                                {t('حفظ')}
                            </button>
                            {car.errors.vehicle_plate && (
                                <p role="alert">
                                    {t(car.errors.vehicle_plate)}
                                </p>
                            )}
                        </form>
                    )}
                    {!report.deleted_at && (
                        <details className="rounded-xl border p-3">
                            <summary className="cursor-pointer">
                                {t('بيانات الخدمة الاختيارية')}
                            </summary>
                            <ServiceFactsForm
                                key={`${report.id}-${report.source_version}-${currentServiceFact?.version ?? 0}`}
                                base={base}
                                current={currentServiceFact}
                                sourceVersion={report.source_version}
                                history={serviceFacts}
                            />
                        </details>
                    )}
                    <ReportSourceHistory pages={sourceChanges} base={base} />
                    {revisions.length > 0 && (
                        <details className="rounded-xl border p-3">
                            <summary className="cursor-pointer">
                                {t('سجل المراجعات السابق')}
                            </summary>
                            {revisions.map((revision) => (
                                <article
                                    key={revision.id}
                                    className="mt-3 rounded-xl bg-slate-50 p-3"
                                >
                                    <p
                                        dir="ltr"
                                        className="whitespace-pre-wrap"
                                    >
                                        {revision.english_report}
                                    </p>
                                    <p className="mt-2 text-sm text-slate-500">
                                        {revision.reason}
                                    </p>
                                </article>
                            ))}
                        </details>
                    )}
                    {canDelete && (
                        <button
                            className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-red-700"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        t(
                                            'حذف التقرير ومرفقاته نهائيًا؟ لا يمكن التراجع.',
                                        ),
                                    )
                                )
                                    router.delete(base);
                            }}
                        >
                            <Trash2 size={17} />
                            {t('حذف نهائي')}
                        </button>
                    )}
                </div>
            </details>
        </main>
    );
}
