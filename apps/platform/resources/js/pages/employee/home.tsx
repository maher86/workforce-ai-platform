import { Head, Link, router } from '@inertiajs/react';
import { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import EmployeeProfilePhoto from '@/components/employee-profile-photo';
import { EmployeeGuidance } from '@/components/employee-guidance';
import ReportComposer from '@/components/report-composer';
import type { WorkItem } from '@/components/report-composer';

export default function EmployeeHome({
    employeeName,
    tenantName,
    reports,
    workItems,
    aiMode,
    employeePhone,
    profilePhotoUrl,
}: {
    employeeName: string;
    tenantName: string;
    reports: { id: number; status: string; created_at: string }[];
    workItems: WorkItem[];
    aiMode: string;
    employeePhone: string | null;
    profilePhotoUrl: string | null;
}) {
    const pending = reports.some((report) =>
        ['submitted', 'processing'].includes(report.status),
    );
    useEffect(() => {
        if (!pending) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['reports'] }),
            8000,
        );
        return () => window.clearInterval(timer);
    }, [pending]);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="mx-auto flex min-h-svh max-w-xl flex-col items-center gap-5 bg-slate-50 p-5 text-center text-slate-900"
        >
            <Head title="حسابي" />
            <EmployeeProfilePhoto url={profilePhotoUrl} name={employeeName} />
            <h1 className="text-3xl font-bold">{employeeName}</h1>
            <p className="text-xl">{tenantName}</p>
            {employeePhone && (
                <p dir="ltr" className="text-lg text-slate-600">
                    {employeePhone}
                </p>
            )}
            {aiMode !== 'openai' && (
                <p className="rounded-xl bg-amber-100 p-3 text-sm text-amber-950">
                    نسخة تجريبية: تُحفظ الملفات، ومعالجة AI محاكاة فقط. استخدم
                    بيانات وهمية.
                </p>
            )}
            <ReportComposer workItems={workItems} />
            <section className="w-full space-y-3 text-right">
                <h2 className="text-xl font-bold">تقاريري</h2>
                {reports.map((report) => (
                    <Link
                        className="flex items-center justify-between rounded-xl border bg-white p-4"
                        key={report.id}
                        href={`/employee/reports/${report.id}`}
                    >
                        <span>
                            #{report.id} ·{' '}
                            {new Date(report.created_at).toLocaleString('ar')}
                        </span>
                        <span>
                            {{
                                submitted: '📤 تم الاستلام',
                                processing: '⏳ تجري المعالجة',
                                ready: '✅ جاهز',
                                failed: '⚠️ اطلب مساعدة المدير',
                            }[report.status] || report.status}
                        </span>
                    </Link>
                ))}
            </section>
            <EmployeeGuidance />
            <button
                className="mt-10 flex items-center gap-3 rounded-xl border p-4"
                onClick={() => {
                    if (
                        window.confirm(
                            'إلغاء تفعيل هذا الهاتف؟ ستحتاج إلى رمز جديد من المدير.',
                        )
                    )
                        router.post('/employee/disconnect');
                }}
            >
                <LogOut />
                إلغاء تفعيل الهاتف
            </button>
        </main>
    );
}
