import { useSyncExternalStore } from 'react';
import { ReportUploadStore } from '@/lib/report-upload';
import { notifyReportReceived } from '@/lib/report-notifications';

export const reportUpload = new ReportUploadStore({
    xhr: () => new XMLHttpRequest(),
    csrf: () =>
        decodeURIComponent(
            document.cookie
                .split('; ')
                .find((part) => part.startsWith('XSRF-TOKEN='))
                ?.slice('XSRF-TOKEN='.length) ?? '',
        ),
    received: () => {
        void notifyReportReceived().catch(() => {});
    },
});
export const useReportUpload = () =>
    useSyncExternalStore(
        reportUpload.subscribe,
        reportUpload.getSnapshot,
        reportUpload.getSnapshot,
    );
