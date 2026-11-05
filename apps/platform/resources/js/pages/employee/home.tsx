import { Head, router } from '@inertiajs/react';
import { CircleUserRound, LogOut } from 'lucide-react';
import { EmployeeGuidance } from '@/components/employee-guidance';

export default function EmployeeHome({
    employeeName,
    tenantName,
}: {
    employeeName: string;
    tenantName: string;
}) {
    return (
        <main
            dir="rtl"
            lang="ar"
            className="flex min-h-svh flex-col items-center justify-center gap-6 bg-slate-50 p-6 text-center text-slate-900"
        >
            <Head title="حسابي" />
            <CircleUserRound size={96} className="text-teal-700" />
            <h1 className="text-3xl font-bold">{employeeName}</h1>
            <p className="text-xl">{tenantName}</p>
            <div className="rounded-2xl bg-teal-100 p-5 text-lg text-teal-950">
                تم تفعيل هاتفك ✓
            </div>
            <EmployeeGuidance />
            <p className="max-w-sm text-slate-600">
                إرسال الصوت والصور سيُضاف في مرحلة التقارير التالية.
            </p>
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
