import { Head, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import {
    AlertTriangle,
    Check,
    FileAudio,
    LogOut,
    Settings2,
    X,
} from 'lucide-react';
import EmployeeProfilePhoto from '@/components/employee-profile-photo';
import EmployeeActivity from '@/components/employee-activity';
import type { DayPages } from '@/components/report-day-accordion';
import { EmployeeGuidance } from '@/components/employee-guidance';
import ReportComposer from '@/components/report-composer';

export default function EmployeeHome({
    employeeName,
    reports,
    profilePhotoUrl,
    days,
    aiMode,
}: {
    employeeName: string;
    reports: { id: number; status: string; created_at: string }[];
    profilePhotoUrl: string | null;
    days: DayPages;
    aiMode: string;
}) {
    const [settings, setSettings] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const pending = reports.some((report) =>
        ['submitted', 'processing'].includes(report.status),
    );
    useEffect(() => {
        if (!pending) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['reports', 'days'] }),
            8000,
        );
        return () => window.clearInterval(timer);
    }, [pending]);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface employee-surface"
        >
            <Head title="حسابي" />
            <div className="workforce-cover">
                <div className="flex justify-between p-5">
                    <button
                        type="button"
                        className="cover-icon"
                        aria-label="إعدادات الجهاز"
                        aria-expanded={settings}
                        onClick={() => setSettings(!settings)}
                    >
                        <Settings2 size={22} />
                    </button>
                    {aiMode !== 'openai' && (
                        <span
                            role="img"
                            aria-label="وضع تجريبي: معالجة الذكاء الاصطناعي محاكاة"
                            title="معالجة تجريبية"
                            className="cover-icon text-orange-300"
                        >
                            <AlertTriangle size={20} />
                        </span>
                    )}
                </div>
            </div>
            <header className="employee-identity">
                <EmployeeProfilePhoto
                    url={profilePhotoUrl}
                    name={employeeName}
                />
                <h1 className="mt-3 text-xl font-extrabold text-slate-800">
                    {employeeName}
                </h1>
            </header>
            {settings && (
                <div className="mx-5 flex items-center justify-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
                    <EmployeeGuidance />
                    <button
                        type="button"
                        className="workforce-icon text-red-600"
                        aria-label="إلغاء تفعيل هذا الهاتف"
                        onClick={() => setConfirm(!confirm)}
                    >
                        <LogOut size={22} />
                    </button>
                    {confirm && (
                        <>
                            <button
                                type="button"
                                aria-label="تأكيد إلغاء تفعيل الهاتف"
                                className="workforce-icon bg-red-50 text-red-700"
                                onClick={() =>
                                    router.post('/employee/disconnect')
                                }
                            >
                                <Check />
                            </button>
                            <button
                                type="button"
                                aria-label="إلغاء"
                                className="workforce-icon"
                                onClick={() => setConfirm(false)}
                            >
                                <X />
                            </button>
                        </>
                    )}
                </div>
            )}
            <div className="space-y-7 px-5 pb-8">
                <ReportComposer />
                <section aria-label="سجل تقاريري" className="space-y-4">
                    <div className="flex items-center justify-between px-1 text-slate-700">
                        <FileAudio className="text-orange-500" size={27} />
                        <span className="text-sm font-bold tabular-nums">
                            {days.data.reduce((sum, day) => sum + day.total, 0)}
                        </span>
                    </div>
                    <EmployeeActivity days={days} />
                </section>
            </div>
        </main>
    );
}
