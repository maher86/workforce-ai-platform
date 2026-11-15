import { useEffect } from 'react';
import { reportProgress, useReportProgress } from '@/hooks/use-report-upload';
import { processingReport } from '@/lib/report-progress';

export function useProgressPolling(scope: string | null) {
    const state = useReportProgress();
    const ids = state.reports
        .filter(processingReport)
        .map((report) => report.id)
        .sort((a, b) => a - b)
        .join(',');
    useEffect(() => {
        if (!scope || !ids) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        let controller: AbortController | null = null;
        let failures = 0;
        const poll = async () => {
            controller = new AbortController();
            const timeout = window.setTimeout(() => controller?.abort(), 15000);
            try {
                const query = new URLSearchParams();
                ids.split(',').forEach((id) => query.append('ids[]', id));
                const response = await fetch(
                    `/employee/report-progress?${query}`,
                    {
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'X-Employee-Upload-Scope': scope,
                        },
                        signal: controller.signal,
                    },
                );
                if (
                    !response.ok ||
                    !response.headers
                        .get('content-type')
                        ?.includes('application/json')
                )
                    throw new Error('progress_unavailable');
                const body = (await response.json()) as { reports?: unknown };
                if (!stopped && !reportProgress.update(scope, body.reports))
                    throw new Error('invalid_progress');
                failures = 0;
            } catch {
                if (!stopped) {
                    failures++;
                    reportProgress.disconnected(scope);
                }
            } finally {
                window.clearTimeout(timeout);
                if (!stopped)
                    timer = setTimeout(
                        () => {
                            void poll();
                        },
                        failures
                            ? Math.min(30000, 5000 * 2 ** failures)
                            : document.hidden
                              ? 15000
                              : 4000,
                    );
            }
        };
        void poll();
        return () => {
            stopped = true;
            controller?.abort();
            clearTimeout(timer);
        };
    }, [scope, ids]);
}
