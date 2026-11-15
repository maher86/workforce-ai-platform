import { useUiLocale } from '@/hooks/use-ui-locale';
export type ServiceMetrics = {
    confirmed: number;
    classified: number;
    assessed: number;
    timed: number;
    reworks: number;
    reworkRate: number | null;
    averageMinutes: number | null;
    services: { label: string; total: number }[];
};
export default function ServiceInsights({
    metrics,
    total,
}: {
    metrics: ServiceMetrics;
    total: number;
}) {
    const { t } = useUiLocale();

    return (
        <section className="space-y-5 rounded-3xl border border-teal-200 bg-white p-6">
            <h2 className="text-xl font-bold">
                {' '}
                {t('الخدمات وإعادة العمل — تأكيد المدير')}{' '}
            </h2>
            <p className="text-sm text-slate-600">
                {' '}
                {t(
                    'أحدث إصدار لكل تقرير ضمن فترة إرسال التقارير والموظف المحدد. بيانات مؤكدة في',
                )}{' '}
                {metrics.confirmed} {t('من')} {total}{' '}
                {t('تقرير؛ الباقي غير مقيم.')}{' '}
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-teal-50 p-4">
                    <p>{t('تقارير إعادة العمل')}</p>
                    <strong className="text-3xl">
                        {metrics.reworkRate === null
                            ? '—'
                            : `${metrics.reworkRate}%`}
                    </strong>
                    <p className="mt-2 text-sm">
                        {metrics.reworks} {t('من')} {metrics.assessed}{' '}
                        {t('تقريرًا قُيّمت إعادة العمل فيه.')}{' '}
                        {total - metrics.assessed} {t('لم تُقيّم.')}{' '}
                    </p>
                </div>
                <div className="rounded-2xl bg-sky-50 p-4">
                    <p>{t('متوسط الفترة الموثقة للتقرير')}</p>
                    <strong className="text-3xl">
                        {metrics.averageMinutes === null
                            ? '—'
                            : `${metrics.averageMinutes} ${t('دقيقة')}`}
                    </strong>
                    <p className="mt-2 text-sm">
                        {' '}
                        {t('من')} {metrics.timed}{' '}
                        {t(
                            'تقريرًا له بداية ونهاية. لا يمثل ساعات الأجر أو وقت عمل فريدًا.',
                        )}{' '}
                    </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4">
                    <p>{t('تغطية تصنيف الخدمة')}</p>
                    <strong className="text-3xl">
                        {metrics.classified} / {total}
                    </strong>
                    <p className="mt-2 text-sm">
                        {' '}
                        {t('التقارير غير المصنفة لا تدخل توزيع الخدمات.')}{' '}
                    </p>
                </div>
            </div>
            <div className="space-y-3">
                <h3 className="font-bold">
                    {t('توزيع أنواع الخدمات المسجلة')}
                </h3>
                {metrics.services.length === 0 ? (
                    <p>{t('لم يُسجل نوع خدمة خلال هذه الفترة.')}</p>
                ) : (
                    metrics.services.map((item) => (
                        <div key={item.label}>
                            <div className="mb-1 flex justify-between gap-3">
                                <span>{item.label}</span>
                                <span>
                                    {item.total} {t('تقرير')}
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-teal-50">
                                <div
                                    className="h-2 rounded-full bg-teal-600"
                                    style={{
                                        width: `${(100 * item.total) / Math.max(1, metrics.classified)}%`,
                                    }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
