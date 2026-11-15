export type ReportProgress = {
    id: number;
    source_version: number;
    status: 'submitted' | 'processing' | 'ready' | 'failed' | 'withdrawn';
    phase?:
        | 'queued'
        | 'transcribing'
        | 'translating'
        | 'finalizing'
        | 'ready'
        | 'failed'
        | 'withdrawn';
};
export const processingReport = (report: ReportProgress) =>
    report.status === 'submitted' || report.status === 'processing';
export function readReportProgress(value: unknown): ReportProgress | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as ReportProgress;
    if (
        !Number.isSafeInteger(item.id) ||
        item.id < 1 ||
        !Number.isSafeInteger(item.source_version) ||
        item.source_version < 1 ||
        !['submitted', 'processing', 'ready', 'failed', 'withdrawn'].includes(
            item.status,
        )
    )
        return null;
    return {
        id: item.id,
        source_version: item.source_version,
        status: item.status,
        phase: item.phase,
    };
}

// Only bounded report IDs/statuses live here. Evidence and credentials are never persisted.
export class ReportProgressStore {
    private state: {
        scope: string | null;
        reports: ReportProgress[];
        connectionError: boolean;
    } = { scope: null, reports: [], connectionError: false };
    private listeners = new Set<() => void>();
    private ready: () => void;
    constructor(ready: () => void = () => {}) {
        this.ready = ready;
    }
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    private publish() {
        this.listeners.forEach((listener) => listener());
    }
    setScope(scope: string | null) {
        if (scope === this.state.scope) return;
        this.state = { scope, reports: [], connectionError: false };
        this.publish();
    }
    track(scope: string, report: ReportProgress, notify = true) {
        if (scope !== this.state.scope || !readReportProgress(report)) return;
        const previous = this.state.reports.find(
            (item) => item.id === report.id,
        );
        if (previous && previous.source_version > report.source_version) return;
        if (
            previous?.source_version === report.source_version &&
            (previous.status === 'withdrawn' ||
                (previous.status === 'ready' &&
                    report.status !== 'ready' &&
                    report.status !== 'withdrawn'))
        )
            return;
        let reports = this.state.reports.filter(
            (item) => item.id !== report.id,
        );
        if (reports.length >= 20) reports = reports.filter(processingReport);
        if (reports.length >= 20) return;
        this.state = {
            ...this.state,
            reports: [...reports, report],
            connectionError: false,
        };
        this.publish();
        if (
            notify &&
            report.status === 'ready' &&
            (!previous ||
                previous.status !== 'ready' ||
                previous.source_version !== report.source_version)
        ) {
            try {
                this.ready();
            } catch {
                /* Notification failure never changes processing truth. */
            }
        }
    }
    update(scope: string, reports: unknown): boolean {
        if (
            scope !== this.state.scope ||
            !Array.isArray(reports) ||
            !reports.every(readReportProgress)
        )
            return false;
        const known = new Set(this.state.reports.map((report) => report.id));
        for (const report of reports as ReportProgress[]) {
            if (known.has(report.id)) this.track(scope, report);
        }
        if (this.state.connectionError) {
            this.state = { ...this.state, connectionError: false };
            this.publish();
        }
        return true;
    }
    disconnected(scope: string) {
        if (scope !== this.state.scope || this.state.connectionError) return;
        this.state = { ...this.state, connectionError: true };
        this.publish();
    }
    dismissFinished() {
        this.state = {
            ...this.state,
            reports: this.state.reports.filter(processingReport),
            connectionError: false,
        };
        this.publish();
    }
}
