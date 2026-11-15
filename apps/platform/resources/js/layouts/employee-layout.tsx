import { router, usePage } from '@inertiajs/react';
import { useEffect, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import {
    reportProgress,
    reportUpload,
    useReportProgress,
    useReportUpload,
} from '@/hooks/use-report-upload';
import { uploadPending } from '@/lib/report-upload';
import { useProgressPolling } from '@/hooks/use-report-progress';
import { processingReport } from '@/lib/report-progress';
import ReportProgressCircle from '@/components/report-progress-circle';

export default function EmployeeLayout({ children }: { children: ReactNode }) {
    const page = usePage<{
        employeeUploadScope: string | null;
    }>();
    const { employeeUploadScope } = page.props;
    const state = useReportUpload();
    const progress = useReportProgress();
    useProgressPolling(employeeUploadScope);
    useLayoutEffect(() => {
        reportUpload.setScope(employeeUploadScope);
        reportProgress.setScope(employeeUploadScope);
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
            reportProgress.setScope(null);
        };
    }, []);
    const finishedKey = progress.reports
        .filter((report) => !processingReport(report))
        .map(
            (report) =>
                `${report.id}:${report.source_version}:${report.status}`,
        )
        .join(',');
    useEffect(() => {
        if (
            state.scope !== employeeUploadScope ||
            (state.status !== 'success' && !finishedKey)
        )
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
        finishedKey,
    ]);
    return (
        <>
            {children}
            <ReportProgressCircle />
        </>
    );
}
