import ReportSourceHistory from '@/components/report-source-history';
import type { SourcePages } from '@/components/report-source-history';
import ServiceFactsForm from '@/components/service-facts-form';
import type { ServiceFact, FactHistory } from '@/components/service-facts-form';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

type Claim = {
    description: string;
    evidence_ids: string[];
    quantity: string | null;
    completion: string;
};
type Output = {
    id: number;
    stage: string;
    provider: string;
    model: string;
    prompt_version: string;
    payload: {
        text?: string;
        english?: string;
        summary?: string;
        observations?: string[];
        uncertainties?: string[];
        claims?: Claim[];
    };
};
type Report = {
    id: number;
    tenant_id: number;
    source_text: string | null;
    status: string;
    review_status: string;
    version: number;
    source_version: number;
    deleted_at: string | null;
    failure_code: string | null;
};
type Revision = {
    id: number;
    version: number;
    english_report: string;
    reason: string;
    status: string;
    created_at: string;
    actor_id: number;
};
type Props = {
    report: Report;
    employeeName: string;
    employeePhone: string | null;
    employeePhotoUrl: string | null;
    media: { id: number; kind: string }[];
    outputs: Output[];
    revisions: Revision[];
    sourceChanges: SourcePages;
    currentServiceFact: ServiceFact | null;
    serviceFacts: FactHistory;
    aiMode: string;
    canDelete: boolean;
    vehicle: { id: number; plate: string } | null;
};

export default function ShowReport({
    report,
    employeeName,
    employeePhone,
    employeePhotoUrl,
    media,
    outputs,
    revisions,
    aiMode,
    canDelete,
    currentServiceFact,
    serviceFacts,
    sourceChanges,
    vehicle,
}: Props) {
    const car = useForm({ vehicle_plate: vehicle?.plate || '' });
    const base = `/tenants/${report.tenant_id}/reports/${report.id}`;
    useEffect(() => {
        if (!['submitted', 'processing'].includes(report.status)) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['report', 'outputs', 'revisions'] }),
            8000,
        );
        return () => window.clearInterval(timer);
    }, [report.status]);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface manager-surface mx-auto w-full max-w-5xl space-y-6 p-5"
        >
            <Head title={`تقرير ${report.id}`} />
            <Link
                href={`/tenants/${report.tenant_id}/reports`}
                className="inline-block rounded-lg border p-3"
            >
                العودة للتقارير
            </Link>
            <header>
                {employeePhotoUrl && (
                    <img
                        src={employeePhotoUrl}
                        alt={`صورة ${employeeName}`}
                        className="mb-3 h-20 w-20 rounded-full object-cover"
                    />
                )}
                <h1 className="text-2xl font-bold">
                    تقرير #{report.id} · {employeeName}
                </h1>
                {employeePhone && (
                    <p dir="ltr" className="mt-2 text-start">
                        {employeePhone}
                    </p>
                )}
                <p className="mt-2">
                    الإصدار {report.version} ·{' '}
                    {
                        {
                            submitted: 'تم الاستلام',
                            processing: 'جارٍ التحليل',
                            ready: 'جاهز',
                            failed: 'تعذّر التحليل',
                        }[report.status]
                    }
                </p>
            </header>
            {report.deleted_at && (
                <p
                    role="alert"
                    className="rounded-2xl bg-amber-50 p-4 text-amber-950"
                >
                    حذف الموظف هذا التقرير من قائمته؛ هذه نسخة محفوظة للمراجعة
                    فقط.
                </p>
            )}
            {currentServiceFact &&
                currentServiceFact.source_version !== report.source_version && (
                    <p
                        role="alert"
                        className="rounded-2xl bg-amber-50 p-4 text-amber-950"
                    >
                        تغيّرت مصادر التقرير. بيانات الخدمة السابقة تحتاج إلى
                        تأكيد جديد ولا تدخل المؤشرات حتى ذلك.
                    </p>
                )}
            {!report.deleted_at && (
                <details className="rounded-2xl border p-4">
                    <summary className="cursor-pointer font-semibold">
                        بيانات خدمة إضافية (اختياري)
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
            <section
                className="rounded-2xl border bg-teal-50 p-5 text-slate-900"
                hidden={!!report.deleted_at}
            >
                <h2 className="mb-3 font-bold">السيارة المرتبطة بالتقرير</h2>
                {vehicle && (
                    <Link
                        href={`/tenants/${report.tenant_id}/vehicles/${vehicle.id}`}
                        className="mb-4 inline-block rounded-xl bg-white px-5 py-3 text-xl font-bold text-teal-800"
                    >
                        🚘 {vehicle.plate} · عرض من عمل عليها
                    </Link>
                )}
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        car.post(`${base}/vehicle`, { preserveScroll: true });
                    }}
                    className="flex flex-wrap items-end gap-3"
                >
                    <label className="flex-1">
                        اللوحة كاملة، مع المنطقة والرمز
                        <input
                            maxLength={80}
                            value={car.data.vehicle_plate}
                            onChange={(event) =>
                                car.setData('vehicle_plate', event.target.value)
                            }
                            placeholder="TEST A 123"
                            className="mt-2 w-full rounded-xl border bg-white p-3"
                        />
                    </label>
                    <Button disabled={car.processing}>حفظ الربط</Button>
                </form>
                <p className="mt-3 text-sm text-slate-600">
                    يمكن لعدة موظفين ربط تقارير بالسيارة نفسها. اترك الحقل فارغًا
                    لإلغاء الربط؛ التقرير والأدلة يبقيان محفوظين.
                </p>
                {car.errors.vehicle_plate && (
                    <p role="alert" className="text-red-700">
                        {car.errors.vehicle_plate}
                    </p>
                )}
            </section>
            {aiMode !== 'openai' && (
                <p className="rounded-xl bg-amber-100 p-4 text-amber-950">
                    ناتج تجريبي واضح، وليس تحليلًا فعليًا. لا تعتمد المحاكاة على
                    أنها ترجمة أو حقائق.
                </p>
            )}
            {!report.deleted_at && report.status === 'failed' && (
                <section className="space-y-3 rounded-xl bg-red-50 p-5 text-red-950">
                    <p>
                        تعذرت المعالجة. المصادر محفوظة. تحقق من إعدادات AI
                        والاتصال أو حالة حساب الموظف ثم أعد المحاولة.
                    </p>
                    <Button onClick={() => router.post(`${base}/retry`)}>
                        إعادة المحاولة
                    </Button>
                </section>
            )}
            <section className="space-y-4 rounded-2xl border p-5">
                <h2 className="text-xl font-bold">المصادر الأصلية</h2>
                {report.source_text && (
                    <p className="rounded-xl bg-muted p-4 whitespace-pre-wrap">
                        {report.source_text}
                    </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    {media.map((item) => (
                        <figure key={item.id} className="space-y-2">
                            {item.kind === 'image' ? (
                                <img
                                    src={`${base}/media/${item.id}`}
                                    alt="صورة قدمها الموظف؛ لا تثبت الإكمال بمفردها"
                                    className="max-h-96 w-full rounded-xl object-contain"
                                />
                            ) : (
                                <audio
                                    controls
                                    src={`${base}/media/${item.id}`}
                                    className="w-full"
                                />
                            )}
                            <figcaption className="text-sm text-muted-foreground">
                                {item.kind === 'image'
                                    ? 'صورة داعمة غير مؤكدة'
                                    : 'تسجيل الموظف'}{' '}
                                · {item.kind}:{item.id}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>
            {outputs.map((output) => (
                <section
                    key={output.id}
                    className="space-y-3 rounded-2xl border p-5"
                >
                    <h2 className="text-xl font-bold">
                        {output.stage.startsWith('transcript:')
                            ? 'النص بلغته الأصلية'
                            : output.stage === 'translation'
                              ? 'الترجمة الإنجليزية الأمينة'
                              : output.stage.startsWith('image:')
                                ? 'ملاحظات الصورة · غير مؤكدة'
                                : 'التقرير المنظم المقترح'}
                    </h2>
                    {output.payload.text && (
                        <p dir="auto" className="whitespace-pre-wrap">
                            {output.payload.text}
                        </p>
                    )}
                    {output.payload.english && (
                        <p dir="ltr" className="text-left whitespace-pre-wrap">
                            {output.payload.english}
                        </p>
                    )}
                    {output.payload.summary && (
                        <p dir="ltr" className="text-left whitespace-pre-wrap">
                            {output.payload.summary}
                        </p>
                    )}
                    {output.payload.observations?.map((observation, index) => (
                        <p dir="ltr" className="text-left" key={index}>
                            {observation}
                        </p>
                    ))}
                    {output.payload.claims?.map((claim, index) => (
                        <article
                            key={index}
                            className="rounded-xl bg-muted p-4"
                        >
                            <p dir="ltr" className="text-left">
                                {claim.description}
                            </p>
                            <p className="mt-2 text-sm">
                                الكمية: {claim.quantity ?? 'غير معروفة'} ·
                                الإكمال:{' '}
                                {claim.completion ===
                                'employee_reported_complete'
                                    ? 'ذكره الموظف؛ غير متحقق'
                                    : 'غير معروف'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                المصادر: {claim.evidence_ids.join('، ')}
                            </p>
                        </article>
                    ))}
                    {output.payload.uncertainties?.map((uncertainty, index) => (
                        <p
                            key={index}
                            dir="ltr"
                            className="rounded-lg bg-amber-50 p-3 text-left text-amber-950"
                        >
                            {uncertainty}
                        </p>
                    ))}
                    <details className="text-sm text-muted-foreground">
                        <summary className="cursor-pointer">
                            مصدر المعالجة
                        </summary>
                        <p dir="ltr">
                            {output.provider} · {output.model} ·{' '}
                            {output.prompt_version}
                        </p>
                    </details>
                </section>
            ))}
            {canDelete && (
                <Button
                    variant="destructive"
                    onClick={() => {
                        if (
                            window.confirm(
                                'حذف التقرير ومرفقاته وإصداراته نهائيًا؟ لا يمكن التراجع.',
                            )
                        )
                            router.delete(base);
                    }}
                >
                    حذف التقرير نهائيًا
                </Button>
            )}
            <ReportSourceHistory pages={sourceChanges} base={base} />
            {revisions.length > 0 && (
                <details className="space-y-4 rounded-2xl border p-4">
                    <summary className="cursor-pointer font-semibold">
                        سجل المراجعات السابق
                    </summary>
                    <h2 className="text-xl font-bold">
                        سجل مراجعة المصادر الحالية
                    </h2>
                    {revisions.map((revision) => (
                        <article
                            className="space-y-2 rounded-xl border p-4"
                            key={revision.id}
                        >
                            <h3 className="font-bold">
                                إصدار {revision.version} ·{' '}
                                {revision.status === 'approved'
                                    ? 'اعتماد بشري'
                                    : 'يحتاج تعديلًا'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {new Date(revision.created_at).toLocaleString(
                                    'ar',
                                )}{' '}
                                · المراجع #{revision.actor_id}
                            </p>
                            <p
                                dir="ltr"
                                className="text-left whitespace-pre-wrap"
                            >
                                {revision.english_report}
                            </p>
                            <p>{revision.reason}</p>
                        </article>
                    ))}
                </details>
            )}
        </main>
    );
}
