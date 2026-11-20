export type UploadReceipt = {
    id: number;
    source_version: number;
    status: 'submitted' | 'processing' | 'ready' | 'failed';
};
export type ReceiptJob = { scope: string; url: string; body: FormData };

export function readUploadReceipt(value: unknown): UploadReceipt | null {
    // Some native transports return serialized JSON inside their JSON response.
    for (let depth = 0; depth < 2 && typeof value === 'string'; depth++) {
        if (value.length > 4096) return null;
        try {
            value = JSON.parse(value.replace(/^\uFEFF/, '')) as unknown;
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const receipt = value as UploadReceipt;
    if (
        !Number.isSafeInteger(receipt.id) ||
        receipt.id < 1 ||
        !Number.isSafeInteger(receipt.source_version) ||
        receipt.source_version < 1 ||
        !['submitted', 'processing', 'ready', 'failed'].includes(receipt.status)
    )
        return null;
    return {
        id: receipt.id,
        source_version: receipt.source_version,
        status: receipt.status,
    };
}

export function receiptMatches(
    job: ReceiptJob,
    receipt: UploadReceipt,
): boolean {
    if (job.url === '/employee/reports') return receipt.source_version === 1;
    const match = /^\/employee\/reports\/([1-9]\d*)\/amend$/.exec(job.url);
    const version = Number(job.body.get('source_version'));
    return Boolean(
        match &&
        receipt.id === Number(match[1]) &&
        Number.isSafeInteger(version) &&
        version >= 1 &&
        receipt.source_version === version + 1,
    );
}

export function receiptLookupUrl(job: ReceiptJob): string | null {
    const edit = /^\/employee\/reports\/([1-9]\d*)\/amend$/.exec(job.url);
    if (job.url !== '/employee/reports' && !edit) return null;
    const key = job.body.get(edit ? 'change_key' : 'submission_key');
    if (
        typeof key !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            key,
        )
    )
        return null;
    const query = new URLSearchParams({ key });
    if (edit) {
        const version = Number(job.body.get('source_version'));
        if (!Number.isSafeInteger(version) || version < 1 || version > 20)
            return null;
        query.set('report_id', edit[1]);
        query.set('source_version', String(version));
    }
    return `/employee/upload-receipt?${query}`;
}

export async function findUploadReceipt(
    job: ReceiptJob,
    signal: AbortSignal,
): Promise<unknown> {
    const url = receiptLookupUrl(job);
    if (!url) throw new Error('receipt_key_unavailable');
    const response = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal,
        headers: {
            Accept: 'application/json',
            'X-Employee-Upload-Scope': job.scope,
        },
    });
    if (
        !response.ok ||
        !response.headers.get('content-type')?.includes('application/json')
    )
        throw new Error('receipt_unconfirmed');
    return response.json() as Promise<unknown>;
}
