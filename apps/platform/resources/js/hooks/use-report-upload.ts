import { useSyncExternalStore } from 'react';
import { ReportUploadStore } from '@/lib/report-upload';
import { notifyReportReceived } from '@/lib/report-notifications';
import { ReportProgressStore } from '@/lib/report-progress';
import { findUploadReceipt } from '@/lib/upload-receipt';

export const reportProgress = new ReportProgressStore(() => {
    void notifyReportReceived().catch(() => {});
});
export const useReportProgress = () =>
    useSyncExternalStore(
        reportProgress.subscribe,
        reportProgress.getSnapshot,
        reportProgress.getSnapshot,
    );

export const reportUpload = new ReportUploadStore({
    xhr: () => new XMLHttpRequest(),
    confirm: findUploadReceipt,
    csrf: () =>
        decodeURIComponent(
            document.cookie
                .split('; ')
                .find((part) => part.startsWith('XSRF-TOKEN='))
                ?.slice('XSRF-TOKEN='.length) ?? '',
        ),
    received: (report) => {
        const scope = reportUpload.getSnapshot().scope;
        if (scope) reportProgress.track(scope, report);
    },
});
export const useReportUpload = () =>
    useSyncExternalStore(
        reportUpload.subscribe,
        reportUpload.getSnapshot,
        reportUpload.getSnapshot,
    );
