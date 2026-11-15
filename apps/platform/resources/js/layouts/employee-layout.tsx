import { Link, router, usePage } from '@inertiajs/react';
import { CheckCircle2, CloudUpload, TriangleAlert, X } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { reportUpload, useReportUpload } from '@/hooks/use-report-upload';
import { uploadPending } from '@/lib/report-upload';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
    const page = usePage<{
        employeeUploadScope: string | null;
    }>();
    const { employeeUploadScope } = page.props;
    const state = useReportUpload();
    useLayoutEffect(() => {
        reportUpload.setScope(employeeUploadScope);
    }, [employeeUploadScope]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (
                uploadPending(reportUpload.getSnapshot()) ||
                reportUpload.getSnapshot().status === 'error'
            )
                event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => {
            window.removeEventListener('beforeunload', warn);
            reportUpload.setScope(null);
        };
    }, []);
    useEffect(() => {
        if (state.status !== 'success' || state.scope !== employeeUploadScope)
            return;
        const path = page.url.split('?')[0];
        if (path === '/employee' || path === '/employee/history')
            router.reload({
                only: path === '/employee' ? ['reports', 'days'] : ['days'],
            });
    }, [
        state.status,
        state.scope,
        state.reportId,
        employeeUploadScope,
        page.url,
    ]);
    const visible =
        employeeUploadScope &&
        state.scope === employeeUploadScope &&
        state.status !== 'idle';
    return (
        <>
            {children}
            {visible && (
                <aside
                    aria-label="حالة إرسال التقرير"
                    className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-full border border-white bg-white p-3 shadow-xl"
                >
                    <Link
                        href="/employee/upload"
                        aria-label={
                            state.status === 'success'
                                ? 'تم استلام التقرير'
                                : state.status === 'error'
                                  ? 'تعذّر إرسال التقرير'
                                  : 'متابعة رفع التقرير'
                        }
                        className={`flex items-center gap-3 rounded-full p-2 ${state.status === 'success' ? 'text-emerald-700' : state.status === 'error' ? 'text-red-700' : 'text-orange-600'}`}
                    >
                        {state.status === 'success' ? (
                            <CheckCircle2 size={30} />
                        ) : state.status === 'error' ? (
                            <TriangleAlert size={30} />
                        ) : (
                            <CloudUpload size={30} className="animate-pulse" />
                        )}
                        {uploadPending(state) && (
                            <span className="tabular-nums" dir="ltr">
                                {state.progress}%
                            </span>
                        )}
                        <span className="sr-only" role="status">
                            {state.status === 'success'
                                ? 'تم استلام التقرير؛ الترجمة تُستكمل في الخلفية'
                                : state.status === 'error'
                                  ? 'تعذّر إرسال التقرير'
                                  : 'جارٍ إرسال التقرير'}
                        </span>
                    </Link>
                    {state.status === 'success' && (
                        <button
                            type="button"
                            onClick={() => reportUpload.dismiss()}
                            aria-label="إغلاق الإشعار"
                            className="rounded-full p-2"
                        >
                            <X size={20} />
                        </button>
                    )}
                </aside>
            )}
        </>
    );
}
