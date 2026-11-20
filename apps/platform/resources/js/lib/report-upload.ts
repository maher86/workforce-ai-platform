import { readUploadReceipt, receiptMatches } from './upload-receipt.ts';
import type { ReceiptJob, UploadReceipt } from './upload-receipt';

export type UploadState = {
    scope: string | null;
    status: 'idle' | 'uploading' | 'confirming' | 'success' | 'error';
    progress: number;
    reportId: number | null;
    error: string;
};

export const uploadPending = (state: UploadState) =>
    state.status === 'uploading' || state.status === 'confirming';

type UploadJob = ReceiptJob;
type Options = {
    xhr: () => XMLHttpRequest;
    csrf: () => string;
    confirm?: (job: ReceiptJob, signal: AbortSignal) => Promise<unknown>;
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
    private confirmation: AbortController | null = null;
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
        this.confirmation?.abort();
        this.confirmation = null;
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
        let settled = false;
        let confirming = false;
        const current = () =>
            !settled &&
            generation === this.generation &&
            job.scope === this.state.scope;
        this.publish({
            status: 'uploading',
            progress: 0,
            reportId: null,
            error: '',
        });
        const fail = (error: string) => {
            if (!current()) return;
            settled = true;
            this.request = null;
            this.publish({ status: 'error', error });
        };
        const accept = (receipt: UploadReceipt) => {
            if (!current()) return;
            settled = true;
            this.request = null;
            this.job = null;
            this.publish({
                status: 'success',
                progress: 100,
                reportId: receipt.id,
                error: '',
            });
            try {
                this.options.received?.(receipt);
            } catch {
                /* A notification error cannot undo authoritative receipt. */
            }
        };
        const reconcile = (message: string) => {
            if (!current() || confirming) return;
            if (!this.options.confirm) {
                fail(message);
                return;
            }
            confirming = true;
            this.request = null;
            this.publish({ status: 'confirming', error: '' });
            const controller = new AbortController();
            this.confirmation = controller;
            const timer = setTimeout(() => {
                controller.abort();
                fail(`${message} [RECEIPT-LOOKUP]`);
            }, 10000);
            void Promise.resolve()
                .then(() => {
                    if (!current() || controller.signal.aborted)
                        throw new Error('confirmation_cancelled');
                    return this.options.confirm!(job, controller.signal);
                })
                .then((value) => {
                    if (!current()) return;
                    const receipt = readUploadReceipt(value);
                    if (receipt && receiptMatches(job, receipt))
                        accept(receipt);
                    else fail(`${message} [RECEIPT-LOOKUP]`);
                })
                .catch(() => fail(`${message} [RECEIPT-LOOKUP]`))
                .finally(() => {
                    clearTimeout(timer);
                    if (this.confirmation === controller)
                        this.confirmation = null;
                });
        };
        try {
            const xhr = this.options.xhr();
            this.request = xhr;
            xhr.upload.onprogress = (event) => {
                if (
                    current() &&
                    !confirming &&
                    event.lengthComputable &&
                    event.total > 0
                )
                    this.publish({
                        progress: Math.min(
                            100,
                            Math.round((event.loaded * 100) / event.total),
                        ),
                    });
            };
            // Transferred bytes are not proof that validation/storage has succeeded.
            xhr.upload.onload = () => {
                if (current() && !confirming)
                    this.publish({ status: 'confirming', progress: 100 });
            };
            xhr.onload = () => {
                if (!current() || confirming) return;
                const json = xhr
                    .getResponseHeader('content-type')
                    ?.includes('application/json');
                const successful = xhr.status >= 200 && xhr.status < 300;
                if (!json) {
                    if (successful)
                        reconcile(
                            'تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير. [RECEIPT-CONTENT]',
                        );
                    else
                        fail(
                            `انتهى الدخول أو تعذّر تأكيد الاستلام. اطلب مساعدة المدير. [HTTP-${xhr.status}]`,
                        );
                    return;
                }
                let result: unknown;
                try {
                    result =
                        xhr.responseType === 'json'
                            ? xhr.response
                            : (JSON.parse(
                                  xhr.responseText.replace(/^\uFEFF/, ''),
                              ) as unknown);
                } catch {
                    if (successful)
                        reconcile(
                            'تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير. [RECEIPT-JSON]',
                        );
                    else
                        fail(
                            `تعذّر الإرسال. اطلب مساعدة المدير. [HTTP-${xhr.status}]`,
                        );
                    return;
                }
                if (!successful) {
                    const body =
                        result && typeof result === 'object'
                            ? (result as { errors?: Record<string, unknown> })
                            : {};
                    const errors = Object.values(body.errors ?? {})
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
                const receipt = readUploadReceipt(result);
                if (receipt && receiptMatches(job, receipt)) accept(receipt);
                else
                    reconcile(
                        'تعذّر تأكيد الاستلام. أعد المحاولة بنفس التقرير. [RECEIPT-SHAPE]',
                    );
            };
            xhr.onerror = () =>
                reconcile(
                    'انقطع الاتصال. الملفات محفوظة مؤقتًا في هذه الصفحة. اضغط إعادة المحاولة عند عودة الاتصال.',
                );
            xhr.ontimeout = () =>
                reconcile(
                    'تأخر الاتصال. أعد المحاولة بنفس التقرير لتجنب التكرار.',
                );
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
