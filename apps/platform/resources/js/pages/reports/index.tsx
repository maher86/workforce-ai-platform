import { Head, Link, router, useForm } from '@inertiajs/react';
import { Download, FileText, FolderPlus, Users } from 'lucide-react';
import { useEffect } from 'react';
import type { WorkItem } from '@/components/report-composer';
import { Button } from '@/components/ui/button';

type Report = {
    id: number;
    membership_id: number;
    status: string;
    review_status: string;
    created_at: string;
};
type Props = {
    tenant: { id: number; name: string };
    reports: {
        data: Report[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    employeeNames: Record<string, string>;
    filters: Record<string, string>;
    workItems: WorkItem[];
    aiMode: string;
};
const statusLabels: Record<string, string> = {
    submitted: 'تم الاستلام',
    processing: 'تجري المعالجة',
    ready: 'جاهز للمراجعة',
    failed: 'تعذّرت المعالجة',
    pending: 'بانتظار المراجعة',
    approved: 'معتمد',
    changes_requested: 'يحتاج تعديلًا',
};

export default function Reports({
    tenant,
    reports,
    employeeNames,
    filters,
    workItems,
    aiMode,
}: Props) {
    const filter = useForm({
        status: filters.status || '',
        review_status: filters.review_status || '',
        employee: filters.employee || '',
        from: filters.from || '',
        to: filters.to || '',
    });
    const work = useForm({ kind: 'project', name: '', project_id: '' });
    const pending = reports.data.some((report) =>
        ['submitted', 'processing'].includes(report.status),
    );
    useEffect(() => {
        if (!pending) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['reports'] }),
            10000,
        );
        return () => window.clearInterval(timer);
    }, [pending]);
    const exportParams = new URLSearchParams(
        Object.fromEntries(
            Object.entries(filters).filter(([, value]) => value),
        ),
    );

    return (
        <main
            dir="rtl"
            lang="ar"
            className="mx-auto w-full max-w-6xl space-y-6 p-5"
        >
            <Head title={`تقارير ${tenant.name}`} />
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">تقارير {tenant.name}</h1>
                    <p className="mt-2 text-muted-foreground">
                        افتح التقرير لمراجعة كلام الموظف وأدلته قبل الاعتماد.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href={`/tenants/${tenant.id}/team`}
                        className="flex items-center gap-2 rounded-xl border p-3"
                    >
                        <Users />
                        الفريق
                    </Link>
                    <a
                        href={`/tenants/${tenant.id}/reports/export?${exportParams}`}
                        className="flex items-center gap-2 rounded-xl border p-3"
                    >
                        <Download />
                        تصدير CSV
                    </a>
                </div>
            </header>
            {aiMode !== 'openai' && (
                <p className="rounded-xl bg-amber-100 p-4 text-amber-950">
                    وضع المحاكاة: لا تُجرى ترجمة أو معالجة حقيقية بالذكاء
                    الاصطناعي. المحتوى الأصلي محفوظ للمراجعة. استخدم بيانات وهمية
                    فقط.
                </p>
            )}
            <form
                className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3 lg:grid-cols-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    filter.get(`/tenants/${tenant.id}/reports`, {
                        preserveState: true,
                    });
                }}
            >
                <label>
                    المعالجة
                    <select
                        value={filter.data.status}
                        onChange={(event) =>
                            filter.setData('status', event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border bg-background p-2"
                    >
                        <option value="">الكل</option>
                        {['submitted', 'processing', 'ready', 'failed'].map(
                            (value) => (
                                <option key={value} value={value}>
                                    {statusLabels[value]}
                                </option>
                            ),
                        )}
                    </select>
                </label>
                <label>
                    المراجعة
                    <select
                        value={filter.data.review_status}
                        onChange={(event) =>
                            filter.setData('review_status', event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border bg-background p-2"
                    >
                        <option value="">الكل</option>
                        {['pending', 'approved', 'changes_requested'].map(
                            (value) => (
                                <option key={value} value={value}>
                                    {statusLabels[value]}
                                </option>
                            ),
                        )}
                    </select>
                </label>
                <label>
                    الموظف
                    <select
                        value={filter.data.employee}
                        onChange={(event) =>
                            filter.setData('employee', event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border bg-background p-2"
                    >
                        <option value="">الكل</option>
                        {Object.entries(employeeNames).map(([id, name]) => (
                            <option key={id} value={id}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    من (UTC)
                    <input
                        type="date"
                        value={filter.data.from}
                        onChange={(event) =>
                            filter.setData('from', event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border p-2"
                    />
                </label>
                <label>
                    إلى (UTC)
                    <input
                        type="date"
                        value={filter.data.to}
                        onChange={(event) =>
                            filter.setData('to', event.target.value)
                        }
                        className="mt-1 block w-full rounded-lg border p-2"
                    />
                </label>
                <Button className="self-end" disabled={filter.processing}>
                    تصفية
                </Button>
                {Object.values(filter.errors).length > 0 && (
                    <p role="alert" className="col-span-full text-red-700">
                        {Object.values(filter.errors).join(' ')}
                    </p>
                )}
            </form>
            <section className="space-y-3">
                {reports.data.length === 0 && (
                    <div className="rounded-xl border p-8 text-center">
                        <FileText className="mx-auto mb-4" size={48} />
                        <p>
                            لا توجد تقارير مطابقة. أرسل أول تقرير من هاتف الموظف.
                        </p>
                    </div>
                )}
                {reports.data.map((report) => (
                    <Link
                        key={report.id}
                        href={`/tenants/${tenant.id}/reports/${report.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5 hover:bg-muted"
                    >
                        <div>
                            <h2 className="font-bold">
                                #{report.id} ·{' '}
                                {employeeNames[report.membership_id] || 'موظف'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {new Date(report.created_at).toLocaleString(
                                    'ar',
                                )}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-muted px-3 py-1">
                                {statusLabels[report.status]}
                            </span>
                            <span className="rounded-full border px-3 py-1">
                                {statusLabels[report.review_status]}
                            </span>
                        </div>
                    </Link>
                ))}
            </section>
            <nav className="flex flex-wrap gap-2" aria-label="صفحات التقارير">
                {reports.links.map((link, index) =>
                    link.url ? (
                        <Link
                            key={index}
                            href={link.url}
                            className={`rounded-lg border px-4 py-2 ${link.active ? 'bg-primary text-primary-foreground' : ''}`}
                        >
                            {index === 0
                                ? 'السابق'
                                : index === reports.links.length - 1
                                  ? 'التالي'
                                  : link.label}
                        </Link>
                    ) : null,
                )}
            </nav>
            <details className="rounded-xl border p-5">
                <summary className="cursor-pointer text-lg font-bold">
                    المشاريع والمهام الاختيارية
                </summary>
                <p className="my-3 text-muted-foreground">
                    يمكن للموظف إرسال تقرير دون أي مشروع أو مهمة. إغلاق العنصر لا
                    يحذف التقارير السابقة.
                </p>
                <form
                    className="flex flex-wrap gap-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        work.post(`/tenants/${tenant.id}/work`, {
                            onSuccess: () => work.reset('name'),
                        });
                    }}
                >
                    <label>
                        النوع
                        <select
                            value={work.data.kind}
                            onChange={(event) =>
                                work.setData({
                                    ...work.data,
                                    kind: event.target.value,
                                    project_id: '',
                                })
                            }
                            className="block rounded-lg border bg-background p-2"
                        >
                            <option value="project">مشروع</option>
                            <option value="task">مهمة</option>
                        </select>
                    </label>
                    <label className="flex-1">
                        الاسم
                        <input
                            required
                            maxLength={180}
                            value={work.data.name}
                            onChange={(event) =>
                                work.setData('name', event.target.value)
                            }
                            className="block w-full rounded-lg border p-2"
                        />
                    </label>
                    {work.data.kind === 'task' && (
                        <label>
                            المشروع
                            <select
                                value={work.data.project_id}
                                onChange={(event) =>
                                    work.setData(
                                        'project_id',
                                        event.target.value,
                                    )
                                }
                                className="block rounded-lg border bg-background p-2"
                            >
                                <option value="">بدون مشروع</option>
                                {workItems
                                    .filter(
                                        (item) =>
                                            item.kind === 'project' &&
                                            item.active,
                                    )
                                    .map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                            </select>
                        </label>
                    )}
                    <Button disabled={work.processing} className="self-end">
                        <FolderPlus />
                        إضافة
                    </Button>
                </form>
                {Object.values(work.errors).length > 0 && (
                    <p role="alert" className="text-red-700">
                        {Object.values(work.errors).join(' ')}
                    </p>
                )}
                <ul className="mt-4 space-y-2">
                    {workItems.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                        >
                            <span>
                                {item.kind === 'project' ? '📁' : '📋'}{' '}
                                {item.name} {!item.active && '· مغلق'}
                            </span>
                            {item.active && (
                                <button
                                    className="rounded-lg border px-3 py-1"
                                    onClick={() =>
                                        router.post(
                                            `/tenants/${tenant.id}/work/${item.id}/close`,
                                        )
                                    }
                                >
                                    إغلاق
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            </details>
        </main>
    );
}
