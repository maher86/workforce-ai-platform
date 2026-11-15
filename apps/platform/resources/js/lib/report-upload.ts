export type UploadState = {
    scope: string | null;
    status: 'idle' | 'uploading' | 'confirming' | 'success' | 'error';
    progress: number;
    reportId: number | null;
    error: string;
};

export const uploadPending = (state: UploadState) =>
    state.status === 'uploading' || state.status === 'confirming';

type UploadJob = { scope: string; url: string; body: FormData };
type Options = {
    xhr: () => XMLHttpRequest;
    csrf: () => string;
    received?: (report: {
        id: number;
        source_version: number;
        status: 'submitted' | 'processing' | 'ready' | 'failed';
    }) => void;
};

// Tab memory only: no employee media, credentials or drafts in browser storage.
export class ReportUploadStore {
    private state: UploadState = {
        scope: null,
        status: 'idle',
        progress: 0,
        reportId: null,
        error: '',
    };
    private listeners = new Set<() => void>();
    private job: UploadJob | null = null;
    private request: XMLHttpRequest | null = null;
    private generation = 0;
    private options: Options;

    constructor(options: Options) {
        this.options = options;
    }

    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    private publish(change: Partial<UploadState>) {
        this.state = { ...this.state, ...change };
        this.listeners.forEach((listener) => listener());
    }
    setScope(scope: string | null) {
        if (scope === this.state.scope) return;
        // Invalidate callbacks before aborting so old identities cannot update a new screen.
        this.generation++;
        this.request?.abort();
        this.request = null;
        this.job = null;
        this.publish({
            scope,
            status: 'idle',
            progress: 0,
            reportId: null,
            error: '',
        });
    }
    start(scope: string, url: string, body: FormData) {
        if (
            !scope ||
            scope !== this.state.scope ||
            uploadPending(this.state) ||
            this.state.status === 'error'
        )
            return false;
        if (!/^\/employee\/reports(?:\/[1-9]\d*\/amend)?$/.test(url))
            return false;
        this.job = { scope, url, body };
        this.perform();
        return true;
    }
    retry() {
        if (
            this.state.status !== 'error' ||
            !this.job ||
            this.job.scope !== this.state.scope
        )
            return;
        this.perform();
    }
    dismiss() {
        if (uploadPending(this.state)) return;
        this.job = null;
        this.publish({
            status: 'idle',
            progress: 0,
            reportId: null,
            error: '',
        });
    }
    private perform() {
        const job = this.job;
        if (!job) return;
        const generation = ++this.generation;
        const current = () =>
            generation === this.generation && job.scope === this.state.scope;
        this.publish({
            status: 'uploading',
            progress: 0,
            reportId: null,
            error: '',
        });
        const fail = (error: string) => {
            if (!current()) return;
            this.request = null;
            this.publish({ status: 'error', error });
        };
        try {
            const xhr = this.options.xhr();
            this.request = xhr;
            xhr.upload.onprogress = (event) => {
                if (current() && event.lengthComputable && event.total > 0)
                    this.publish({
                        progress: Math.min(
                            100,
                            Math.round((event.loaded * 100) / event.total),
                        ),
                    });
            };
            // Transferred bytes are not proof that validation/storage has succeeded.
            xhr.upload.onload = () => {
                if (current())
                    this.publish({ status: 'confirming', progress: 100 });
            };
            xhr.onload = () => {
                if (!current()) return;
                const json = xhr
                    .getResponseHeader('content-type')
                    ?.includes('application/json');
                let result: {
                    id?: unknown;
                    source_version?: unknown;
                    status?: unknown;
                    message?: unknown;
                    errors?: Record<string, unknown>;
                } = {};
                try {
                    if (json)
                        result = JSON.parse(xhr.responseText) as typeof result;
                } catch {
                    fail('تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير.');
                    return;
                }
                if (
                    !result ||
                    typeof result !== 'object' ||
                    Array.isArray(result)
                ) {
                    fail('تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير.');
                    return;
                }
                if (!json) {
                    fail(
                        'انتهى الدخول أو تعذّر تأكيد الاستلام. اطلب مساعدة المدير.',
                    );
                    return;
                }
                if (xhr.status < 200 || xhr.status >= 300) {
                    const errors = Object.values(result.errors ?? {})
                        .flat()
                        .filter(
                            (value): value is string =>
                                typeof value === 'string',
                        )
                        .join(' ');
                    fail(
                        xhr.status === 419
                            ? 'انتهت الجلسة. اطلب مساعدة المدير قبل إعادة تحميل الصفحة.'
                            : errors.slice(0, 2000) ||
                                  'تعذّر الإرسال. أعد المحاولة أو اطلب مساعدة المدير.',
                    );
                    return;
                }
                if (
                    typeof result.id !== 'number' ||
                    !Number.isSafeInteger(result.id) ||
                    result.id < 1 ||
                    typeof result.source_version !== 'number' ||
                    !Number.isSafeInteger(result.source_version) ||
                    result.source_version < 1 ||
                    typeof result.status !== 'string' ||
                    !['submitted', 'processing', 'ready', 'failed'].includes(
                        result.status,
                    )
                ) {
                    fail('تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير.');
                    return;
                }
                this.request = null;
                this.job = null;
                this.publish({
                    status: 'success',
                    progress: 100,
                    reportId: result.id,
                    error: '',
                });
                try {
                    this.options.received?.({
                        id: result.id,
                        source_version: result.source_version,
                        status: result.status as
                            | 'submitted'
                            | 'processing'
                            | 'ready'
                            | 'failed',
                    });
                } catch {
                    /* Notification failure must not change a saved report. */
                }
            };
            xhr.onerror = () =>
                fail(
                    'انقطع الاتصال. الملفات محفوظة مؤقتًا في هذه الصفحة. اضغط إعادة المحاولة عند عودة الاتصال.',
                );
            xhr.ontimeout = () =>
                fail('تأخر الاتصال. أعد المحاولة بنفس التقرير لتجنب التكرار.');
            xhr.onabort = () =>
                fail('توقف الرفع. أعد المحاولة أو اطلب مساعدة المدير.');
            xhr.open('POST', job.url);
            xhr.timeout = 300000;
            xhr.withCredentials = true;
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.setRequestHeader('X-XSRF-TOKEN', this.options.csrf());
            xhr.setRequestHeader('X-Employee-Upload-Scope', job.scope);
            xhr.send(job.body);
        } catch {
            fail('تعذّر بدء الرفع. احتفظ بالتطبيق مفتوحًا وأعد المحاولة.');
        }
    }
}
