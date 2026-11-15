import { Link } from '@inertiajs/react';
import {
    AudioLines,
    Bell,
    Check,
    CloudUpload,
    FileAudio,
    Languages,
    LoaderCircle,
    RotateCcw,
    WifiOff,
    X,
} from 'lucide-react';
import { useState } from 'react';
import {
    reportProgress,
    reportUpload,
    useReportProgress,
    useReportUpload,
} from '@/hooks/use-report-upload';
import {
    enableReportNotifications,
    notificationsSupported,
} from '@/lib/report-notifications';
import { processingReport } from '@/lib/report-progress';
import type { ReportProgress } from '@/lib/report-progress';
import { uploadPending } from '@/lib/report-upload';

const phaseLabel = (report: ReportProgress) =>
    report.status === 'ready'
        ? 'اكتمل التفريغ والترجمة'
        : report.status === 'failed'
          ? 'تعذّرت المعالجة'
          : report.status === 'withdrawn'
            ? 'حُذف التقرير'
            : report.phase === 'translating'
              ? 'جارٍ التحويل إلى الإنجليزية'
              : report.phase === 'transcribing'
                ? 'جارٍ تفريغ الصوت'
                : report.phase === 'finalizing'
                  ? 'جارٍ استكمال المعالجة'
                  : 'بانتظار المعالجة';
function PhaseIcon({ report }: { report: ReportProgress }) {
    if (report.status === 'ready') return <Check />;
    if (report.status === 'failed' || report.status === 'withdrawn')
        return <X />;
    if (report.phase === 'translating')
        return <Languages className="animate-pulse" />;
    return <AudioLines className="animate-pulse" />;
}
export default function ReportProgressCircle() {
    const upload = useReportUpload();
    const progress = useReportProgress();
    const [open, setOpen] = useState(false);
    const [discard, setDiscard] = useState(false);
    const [notificationError, setNotificationError] = useState('');
    const [notifications, setNotifications] = useState(false);
    if (
        !upload.scope ||
        upload.scope !== progress.scope ||
        (upload.status === 'idle' && !progress.reports.length)
    )
        return null;
    const transferring = uploadPending(upload);
    const processing = progress.reports.filter(processingReport);
    const failed =
        upload.status === 'error' ||
        progress.reports.some(
            (report) =>
                report.status === 'failed' || report.status === 'withdrawn',
        );
    const done =
        !transferring &&
        !failed &&
        progress.reports.length > 0 &&
        processing.length === 0;
    const label = failed
        ? 'تعذّر إرسال أو معالجة تقرير'
        : done
          ? 'اكتمل التفريغ والترجمة'
          : transferring
            ? `جارٍ رفع التقرير ${upload.progress}%`
            : 'جارٍ تفريغ الصوت والترجمة';
    const color = failed ? '#dc2626' : done ? '#059669' : '#f97316';
    const count =
        processing.length + (transferring || upload.status === 'error' ? 1 : 0);
    const pendingReport = processing.at(-1);
    return (
        <aside
            dir="rtl"
            className="fixed right-4 z-50"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
            aria-label="متابعة التقارير"
        >
            {open && (
                <section
                    aria-label="تفاصيل الرفع والمعالجة"
                    className="mb-3 max-h-[65vh] w-72 max-w-[calc(100vw-32px)] overflow-y-auto rounded-3xl border border-white bg-white p-4 shadow-2xl"
                >
                    <div className="mb-3 flex items-center justify-between">
                        <button
                            type="button"
                            aria-label="إغلاق التفاصيل"
                            onClick={() => setOpen(false)}
                            className="rounded-full p-2"
                        >
                            <X size={20} />
                        </button>
                        {notificationsSupported() && (
                            <button
                                type="button"
                                disabled={notifications}
                                aria-label="السماح بإشعار اكتمال معالجة الصوت"
                                className={`rounded-full p-2 ${notifications ? 'text-emerald-600' : 'text-slate-600'}`}
                                onClick={() => {
                                    void enableReportNotifications()
                                        .then((enabled) => {
                                            setNotifications(enabled);
                                            setNotificationError(
                                                enabled
                                                    ? ''
                                                    : 'لم يُسمح بإشعارات الهاتف. المؤشر داخل التطبيق متاح.',
                                            );
                                        })
                                        .catch(() =>
                                            setNotificationError(
                                                'تعذّر تفعيل إشعارات الهاتف. المؤشر داخل التطبيق متاح.',
                                            ),
                                        );
                                }}
                            >
                                <Bell size={22} />
                            </button>
                        )}
                        {!transferring && (
                            <button
                                type="button"
                                aria-label="مسح الحالات المكتملة"
                                className="rounded-full p-2 text-slate-500"
                                onClick={() => {
                                    reportProgress.dismissFinished();
                                    if (upload.status !== 'error')
                                        reportUpload.dismiss();
                                }}
                            >
                                <Check size={22} />
                            </button>
                        )}
                    </div>
                    {transferring && (
                        <div
                            className="mb-3 flex items-center gap-3 rounded-2xl bg-orange-50 p-3 text-orange-600"
                            aria-label={label}
                        >
                            {upload.status === 'confirming' ? (
                                <LoaderCircle className="animate-spin" />
                            ) : (
                                <CloudUpload />
                            )}
                            <progress
                                aria-label="تقدّم رفع الملف"
                                value={upload.progress}
                                max={100}
                                className="min-w-0 flex-1 accent-orange-500"
                            />
                            <span dir="ltr" className="text-sm tabular-nums">
                                {upload.progress}%
                            </span>
                        </div>
                    )}
                    {progress.reports.map((report) => (
                        <div
                            key={report.id}
                            className={`mb-2 flex items-center gap-3 rounded-2xl p-3 ${report.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : processingReport(report) ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-700'}`}
                            title={phaseLabel(report)}
                        >
                            <span aria-label={phaseLabel(report)}>
                                <PhaseIcon report={report} />
                            </span>
                            <span
                                className="flex-1 text-sm tabular-nums"
                                dir="ltr"
                            >
                                #{report.id}
                            </span>
                            <Link
                                href={
                                    report.status === 'withdrawn'
                                        ? '/employee/history'
                                        : `/employee/reports/${report.id}`
                                }
                                aria-label="فتح التقرير"
                                className="rounded-full p-2"
                            >
                                <FileAudio size={22} />
                            </Link>
                        </div>
                    ))}
                    {progress.reports.some(
                        (report) => report.status === 'failed',
                    ) && (
                        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
                            تعذّرت معالجة أحد التقارير. افتح التقرير واطلب مساعدة
                            المدير.
                        </p>
                    )}
                    {progress.connectionError && (
                        <p
                            role="alert"
                            className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                        >
                            <WifiOff size={20} />
                            تعذّر تحديث حالة المعالجة. ستُعاد المحاولة تلقائيًا.
                        </p>
                    )}
                    {upload.error && (
                        <div className="space-y-3 rounded-2xl bg-red-50 p-3 text-red-900">
                            <p role="alert" className="text-sm">
                                {upload.error}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    aria-label="إعادة رفع نفس التقرير"
                                    className="rounded-full bg-white p-3"
                                    onClick={() => reportUpload.retry()}
                                >
                                    <RotateCcw size={24} />
                                </button>
                                <button
                                    type="button"
                                    aria-label="إلغاء محاولة الرفع"
                                    className="rounded-full bg-white p-3"
                                    onClick={() => setDiscard(!discard)}
                                >
                                    <X size={24} />
                                </button>
                                {discard && (
                                    <button
                                        type="button"
                                        aria-label="تأكيد حذف الملفات المؤقتة؛ تحقق من السجل أولًا"
                                        className="rounded-full bg-white p-3"
                                        onClick={() => {
                                            reportUpload.dismiss();
                                            setDiscard(false);
                                        }}
                                    >
                                        <Check size={24} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {notificationError && (
                        <p
                            role="alert"
                            className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                        >
                            {notificationError}
                        </p>
                    )}
                </section>
            )}
            <button
                type="button"
                aria-label={label}
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className="relative flex h-[84px] w-[84px] items-center justify-center rounded-full border border-white bg-white/95 shadow-[0_10px_35px_rgba(15,23,42,0.2)] backdrop-blur transition-transform active:scale-95"
                style={{ color }}
            >
                <svg
                    aria-hidden="true"
                    viewBox="0 0 84 84"
                    className="absolute inset-0 h-full w-full -rotate-90"
                >
                    <circle
                        cx="42"
                        cy="42"
                        r="36"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="4"
                    />
                    <circle
                        cx="42"
                        cy="42"
                        r="36"
                        fill="none"
                        stroke={color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        pathLength="100"
                        strokeDasharray={`${transferring ? upload.progress : 100} 100`}
                        style={{ transition: 'stroke-dasharray 250ms ease' }}
                    />
                </svg>
                {!done && !failed && (
                    <svg
                        aria-hidden="true"
                        viewBox="0 0 84 84"
                        className={`absolute inset-0 h-full w-full ${!transferring ? 'animate-spin' : ''}`}
                        style={{ animationDuration: '2.5s' }}
                    >
                        <circle
                            cx="42"
                            cy="42"
                            r="28"
                            fill="none"
                            stroke={transferring ? '#fed7aa' : '#8b5cf6'}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            pathLength="100"
                            strokeDasharray={transferring ? '0 100' : '22 12'}
                        />
                    </svg>
                )}
                {failed ? (
                    <X size={34} strokeWidth={2.5} />
                ) : done ? (
                    <Check size={34} strokeWidth={2.5} />
                ) : transferring ? (
                    upload.status === 'confirming' ? (
                        <LoaderCircle size={28} className="animate-spin" />
                    ) : (
                        <CloudUpload size={28} />
                    )
                ) : pendingReport?.phase === 'translating' ? (
                    <Languages size={27} />
                ) : (
                    <AudioLines size={28} className="animate-pulse" />
                )}
                {count > 1 && (
                    <span className="absolute -top-1 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-800 px-1 text-xs font-bold text-white tabular-nums">
                        {count}
                    </span>
                )}
            </button>
            <span role="status" aria-live="polite" className="sr-only">
                {label}
            </span>
        </aside>
    );
}
