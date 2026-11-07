import { Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export type ServiceFact = {
    id: number;
    version: number;
    actor_id: number | null;
    service_type: string | null;
    started_at: string | null;
    ended_at: string | null;
    rework: boolean | null;
    rework_reason: string | null;
    confirmation_note: string;
    created_at: string;
};
export type FactHistory = {
    data: ServiceFact[];
    prev_page_url: string | null;
    next_page_url: string | null;
};
const localTime = (value: string | null) => {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).format(new Date(value));
    return parts.replace(' ', 'T');
};
export default function ServiceFactsForm({
    base,
    current,
    history,
}: {
    base: string;
    current: ServiceFact | null;
    history: FactHistory;
}) {
    const form = useForm({
        version: current?.version ?? 0,
        service_type: current?.service_type ?? '',
        started_at: localTime(current?.started_at ?? null),
        ended_at: localTime(current?.ended_at ?? null),
        rework:
            current?.rework === null || !current
                ? ''
                : current.rework
                  ? '1'
                  : '0',
        rework_reason: current?.rework_reason ?? '',
        confirmation_note: '',
    });
    return (
        <section className="space-y-5 rounded-3xl border border-teal-200 bg-teal-50 p-6 text-slate-900">
            <div>
                <h2 className="text-xl font-bold">
                    بيانات الخدمة المؤكدة من المدير
                </h2>
                <p className="mt-2 text-sm">
                    راجع المصادر ثم أكّد ما تعرفه فقط. كل حفظ يسجل إصدارًا جديدًا؛
                    لا يغير التسجيل أو تقرير الذكاء الاصطناعي.
                </p>
            </div>
            <form
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    form.transform((data) => ({
                        ...data,
                        rework: data.rework === '' ? null : data.rework === '1',
                        rework_reason:
                            data.rework === '1' ? data.rework_reason : null,
                    }));
                    form.post(`${base}/service-facts`, {
                        preserveScroll: true,
                    });
                }}
            >
                <label>
                    نوع الخدمة (اختياري)
                    <input
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                        maxLength={100}
                        placeholder="مثل: تغيير زيت"
                        value={form.data.service_type}
                        onChange={(e) =>
                            form.setData('service_type', e.target.value)
                        }
                    />
                </label>
                <label>
                    هل هذا التقرير عن إعادة عمل؟
                    <select
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                        value={form.data.rework}
                        onChange={(e) => form.setData('rework', e.target.value)}
                    >
                        <option value="">غير معلوم / لم يُقيّم</option>
                        <option value="0">لا</option>
                        <option value="1">نعم</option>
                    </select>
                </label>
                <label>
                    بداية العمل — توقيت دبي
                    <input
                        type="datetime-local"
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                        value={form.data.started_at}
                        onChange={(e) =>
                            form.setData('started_at', e.target.value)
                        }
                    />
                </label>
                <label>
                    نهاية العمل — توقيت دبي
                    <input
                        type="datetime-local"
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                        value={form.data.ended_at}
                        onChange={(e) =>
                            form.setData('ended_at', e.target.value)
                        }
                    />
                </label>
                <p className="text-sm sm:col-span-2">
                    الوقتان اختياريان معًا. الفترة المسجلة لا تثبت الحضور أو ساعات
                    الأجر، وقد تتداخل مع تقارير أخرى.
                </p>
                {form.data.rework === '1' && (
                    <label className="sm:col-span-2">
                        سبب إعادة العمل
                        <textarea
                            required
                            maxLength={2000}
                            className="mt-2 w-full rounded-xl border bg-white p-3"
                            value={form.data.rework_reason}
                            onChange={(e) =>
                                form.setData('rework_reason', e.target.value)
                            }
                        />
                    </label>
                )}
                <label className="sm:col-span-2">
                    مصدر التأكيد / سبب تعديل البيانات
                    <textarea
                        required
                        maxLength={2000}
                        className="mt-2 w-full rounded-xl border bg-white p-3"
                        placeholder="مثل: راجعت التسجيل وأكدت الوقت مع الموظف"
                        value={form.data.confirmation_note}
                        onChange={(e) =>
                            form.setData('confirmation_note', e.target.value)
                        }
                    />
                </label>
                {Object.values(form.errors).length > 0 && (
                    <p role="alert" className="text-red-700 sm:col-span-2">
                        {Object.values(form.errors).join(' ')}
                    </p>
                )}
                <Button disabled={form.processing}>حفظ إصدار مؤكد</Button>
            </form>
            <details>
                <summary className="cursor-pointer font-bold">
                    سجل إصدارات بيانات الخدمة ({current?.version ?? 0})
                </summary>
                <div className="mt-4 space-y-3">
                    {history.data.map((item) => (
                        <article
                            key={item.id}
                            className="space-y-2 rounded-xl bg-white p-4"
                        >
                            <h3 className="font-bold">
                                الإصدار {item.version} ·{' '}
                                {item.service_type || 'خدمة غير مصنفة'}
                            </h3>
                            <p>
                                حفظه المستخدم #{item.actor_id ?? 'محذوف'} ·{' '}
                                {new Date(item.created_at).toLocaleString(
                                    'ar-AE',
                                    { timeZone: 'Asia/Dubai' },
                                )}
                            </p>
                            <p>
                                الفترة بتوقيت دبي:{' '}
                                {localTime(item.started_at).replace('T', ' ') ||
                                    'غير معلومة'}{' '}
                                ←{' '}
                                {localTime(item.ended_at).replace('T', ' ') ||
                                    'غير معلومة'}
                            </p>
                            <p>
                                إعادة العمل:{' '}
                                {item.rework === null
                                    ? 'لم تُقيّم'
                                    : item.rework
                                      ? 'نعم'
                                      : 'لا'}{' '}
                                {item.rework_reason &&
                                    `· ${item.rework_reason}`}
                            </p>
                            <p className="whitespace-pre-wrap">
                                {item.confirmation_note}
                            </p>
                        </article>
                    ))}
                    <nav className="flex gap-5">
                        {history.prev_page_url && (
                            <Link href={history.prev_page_url} preserveScroll>
                                إصدارات أحدث
                            </Link>
                        )}
                        {history.next_page_url && (
                            <Link href={history.next_page_url} preserveScroll>
                                إصدارات أقدم
                            </Link>
                        )}
                    </nav>
                </div>
            </details>
        </section>
    );
}
