import { Head, Link } from '@inertiajs/react';
import {
    Bell,
    Check,
    CheckCircle2,
    CloudUpload,
    FileAudio,
    Home,
    LoaderCircle,
    RotateCcw,
    TriangleAlert,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { reportUpload, useReportUpload } from '@/hooks/use-report-upload';
import {
    enableReportNotifications,
    notificationsSupported,
} from '@/lib/report-notifications';
import { uploadPending } from '@/lib/report-upload';

export default function EmployeeUpload() {
    const state = useReportUpload();
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notifications, setNotifications] = useState(false);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface employee-surface min-h-screen px-5 py-10"
        >
            <Head title="إرسال التقرير" />
            <div className="mx-auto flex max-w-md flex-col items-center gap-7 rounded-3xl bg-white/90 px-6 py-10 shadow-lg">
                <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col items-center gap-5"
                >
                    {state.status === 'success' ? (
                        <CheckCircle2
                            size={100}
                            className="text-emerald-600"
                            aria-label="تم استلام التقرير؛ المعالجة مستمرة"
                        />
                    ) : state.status === 'error' || state.status === 'idle' ? (
                        <TriangleAlert
                            size={100}
                            className="text-amber-600"
                            aria-label="تحقق من حالة الإرسال"
                        />
                    ) : state.status === 'confirming' ? (
                        <LoaderCircle
                            size={100}
                            className="animate-spin text-orange-500"
                            aria-label="جارٍ تأكيد الاستلام"
                        />
                    ) : (
                        <CloudUpload
                            size={100}
                            className="animate-pulse text-orange-500"
                            aria-label="جارٍ رفع التقرير"
                        />
                    )}
                    {uploadPending(state) && (
                        <>
                            <progress
                                aria-label="تقدّم رفع التقرير"
                                max={100}
                                value={state.progress}
                                className="h-4 w-64 max-w-full accent-orange-500"
                            />
                            <span
                                dir="ltr"
                                className="text-3xl font-bold tabular-nums"
                            >
                                {state.progress}%
                            </span>
                        </>
                    )}
                </div>
                {state.error && (
                    <p
                        role="alert"
                        className="rounded-2xl bg-red-50 p-4 text-red-900"
                    >
                        {state.error}
                    </p>
                )}
                {state.status === 'idle' && (
                    <p className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                        لا توجد عملية رفع في هذه الصفحة. بعد إعادة تحميل التطبيق،
                        تحقق من سجل التقارير قبل الإرسال مجددًا.
                    </p>
                )}
                <div className="flex flex-wrap justify-center gap-4">
                    <Link
                        href="/employee"
                        aria-label="العودة إلى حسابي ومتابعة العمل"
                        className="workforce-icon"
                    >
                        <Home size={32} />
                    </Link>
                    <Link
                        href={
                            state.reportId
                                ? `/employee/reports/${state.reportId}`
                                : '/employee/history'
                        }
                        aria-label="عرض التقرير أو سجل التقارير"
                        className="workforce-icon"
                    >
                        <FileAudio size={32} />
                    </Link>
                    {state.status === 'error' && (
                        <>
                            <button
                                type="button"
                                aria-label="إعادة إرسال نفس التقرير"
                                onClick={() => reportUpload.retry()}
                                className="workforce-icon text-orange-600"
                            >
                                <RotateCcw size={32} />
                            </button>
                            <button
                                type="button"
                                aria-label="حذف محاولة الإرسال من هذا الجهاز"
                                onClick={() =>
                                    setConfirmDiscard(!confirmDiscard)
                                }
                                className="workforce-icon text-red-600"
                            >
                                <X size={32} />
                            </button>
                            {confirmDiscard && (
                                <button
                                    type="button"
                                    aria-label="تأكيد حذف الملفات المؤقتة؛ تحقق من السجل أولًا"
                                    onClick={() => {
                                        reportUpload.dismiss();
                                        setConfirmDiscard(false);
                                    }}
                                    className="workforce-icon text-red-700"
                                >
                                    <Check size={32} />
                                </button>
                            )}
                        </>
                    )}
                    {notificationsSupported() && (
                        <button
                            type="button"
                            disabled={notifications}
                            aria-label="السماح بإشعارات استلام التقرير"
                            className={`workforce-icon ${notifications ? 'text-emerald-600' : ''}`}
                            onClick={() => {
                                void enableReportNotifications()
                                    .then((enabled) => {
                                        setNotifications(enabled);
                                        setNotificationError(
                                            enabled
                                                ? ''
                                                : 'لم يُسمح بإشعارات الهاتف. حالة الإرسال متاحة داخل التطبيق.',
                                        );
                                    })
                                    .catch(() =>
                                        setNotificationError(
                                            'تعذّر تفعيل إشعارات الهاتف. حالة الإرسال متاحة داخل التطبيق.',
                                        ),
                                    );
                            }}
                        >
                            <Bell size={28} />
                        </button>
                    )}
                </div>
                {notificationError && (
                    <p
                        role="alert"
                        className="rounded-xl bg-amber-50 p-3 text-amber-900"
                    >
                        {notificationError}
                    </p>
                )}
            </div>
        </main>
    );
}
