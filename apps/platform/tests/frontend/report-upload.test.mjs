import assert from 'node:assert/strict';
import test from 'node:test';
import { ReportUploadStore } from '../../resources/js/lib/report-upload.ts';
import {
    readUploadReceipt,
    receiptLookupUrl,
} from '../../resources/js/lib/upload-receipt.ts';
import {
    ReportProgressStore,
    reportIndicator,
} from '../../resources/js/lib/report-progress.ts';

class Request {
    upload = {};
    headers = {};
    status = 0;
    responseText = '';
    contentType = 'application/json';
    open(method, url) {
        this.method = method;
        this.url = url;
    }
    setRequestHeader(name, value) {
        this.headers[name] = value;
    }
    getResponseHeader() {
        return this.contentType;
    }
    send(body) {
        this.body = body;
    }
    abort() {
        this.aborted = true;
        this.onabort?.();
    }
    respond(status, result) {
        this.status = status;
        this.responseText = JSON.stringify(
            result && typeof result === 'object'
                ? { source_version: 1, status: 'submitted', ...result }
                : result,
        );
        this.onload();
    }
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
const receiptKey = '11111111-1111-4111-8111-111111111111';

await test('typed native JSON, nested serialization and BOM receipts keep strict metadata validation', () => {
    const receipt = { id: 9, source_version: 1, status: 'submitted' };
    for (const mode of ['typed-json', 'nested-json', 'bom']) {
        const { store, requests, body } = fixture();
        store.start('10:20', '/employee/reports', body);
        const xhr = requests[0];
        xhr.status = 201;
        if (mode === 'typed-json') {
            xhr.responseType = 'json';
            xhr.response = receipt;
            Object.defineProperty(xhr, 'responseText', {
                get() {
                    throw new Error('InvalidStateError');
                },
            });
        } else
            xhr.responseText =
                mode === 'nested-json'
                    ? JSON.stringify(JSON.stringify(receipt))
                    : '\uFEFF' + JSON.stringify(receipt);
        xhr.onload();
        assert.equal(store.getSnapshot().status, 'success', mode);
    }
    for (const value of [
        [],
        { ...receipt, id: '9' },
        { ...receipt, status: 'invented' },
        { ...receipt, source_version: 0 },
        '{',
    ])
        assert.equal(readUploadReceipt(value), null);
});

await test('late upload/error/timeout/abort callbacks cannot undo authoritative receipt', () => {
    const { store, requests, body } = fixture();
    store.start('10:20', '/employee/reports', body);
    const xhr = requests[0];
    xhr.respond(201, { id: 9 });
    xhr.upload.onload();
    xhr.onerror();
    xhr.ontimeout();
    xhr.onabort();
    xhr.upload.onprogress({ lengthComputable: true, loaded: 1, total: 10 });
    assert.equal(store.getSnapshot().status, 'success');
    assert.equal(store.getSnapshot().progress, 100);
});

await test('ambiguous upload recovers saved receipt without uploading bytes again; processing stays processing', async () => {
    const requests = [];
    let lookups = 0;
    const progress = new ReportProgressStore();
    progress.setScope('scope');
    const store = new ReportUploadStore({
        xhr: () => {
            const xhr = new Request();
            requests.push(xhr);
            return xhr;
        },
        csrf: () => 'synthetic',
        confirm: async (job) => {
            lookups++;
            assert.equal(job.body.get('submission_key'), receiptKey);
            return { id: 19, source_version: 1, status: 'processing' };
        },
        received: (receipt) => progress.track('scope', receipt),
    });
    store.setScope('scope');
    const body = new FormData();
    body.set('submission_key', receiptKey);
    store.start('scope', '/employee/reports', body);
    requests[0].status = 201;
    requests[0].responseText = '{';
    requests[0].onload();
    assert.equal(store.getSnapshot().status, 'confirming');
    await settle();
    assert.equal(requests.length, 1);
    assert.equal(lookups, 1);
    assert.equal(store.getSnapshot().status, 'success');
    assert.equal(
        reportIndicator(store.getSnapshot(), progress.getSnapshot().reports)
            .state,
        'processing',
    );
    progress.update('scope', [{ id: 19, source_version: 1, status: 'ready' }]);
    assert.equal(
        reportIndicator(store.getSnapshot(), progress.getSnapshot().reports)
            .state,
        'ready',
    );
});

await test('failed confirmation retains original payload and retry key; no manufactured receipt', async () => {
    const requests = [];
    let notices = 0;
    const store = new ReportUploadStore({
        xhr: () => {
            const xhr = new Request();
            requests.push(xhr);
            return xhr;
        },
        csrf: () => 'synthetic',
        confirm: async () => {
            throw new Error('not found');
        },
        received: () => notices++,
    });
    store.setScope('scope');
    const body = new FormData();
    body.set('submission_key', receiptKey);
    store.start('scope', '/employee/reports', body);
    requests[0].onerror();
    await settle();
    assert.equal(store.getSnapshot().status, 'error');
    assert.equal(notices, 0);
    store.retry();
    assert.equal(requests[1].body, body);
    assert.equal(requests[1].body.get('submission_key'), receiptKey);
});

await test('account switch aborts confirmation and ignores a late ready response', async () => {
    let complete;
    let signal;
    let notices = 0;
    const xhr = new Request();
    const store = new ReportUploadStore({
        xhr: () => xhr,
        csrf: () => 'synthetic',
        confirm: (_, value) => {
            signal = value;
            return new Promise((resolve) => {
                complete = resolve;
            });
        },
        received: () => notices++,
    });
    store.setScope('first');
    const body = new FormData();
    body.set('submission_key', receiptKey);
    store.start('first', '/employee/reports', body);
    xhr.onerror();
    await settle();
    store.setScope('second');
    assert.equal(signal.aborted, true);
    complete({ id: 9, source_version: 1, status: 'ready' });
    await settle();
    assert.equal(store.getSnapshot().scope, 'second');
    assert.equal(store.getSnapshot().status, 'idle');
    assert.equal(notices, 0);
});

await test('confirmation timeout stays retryable and ignores completion after its deadline', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let complete;
    const xhr = new Request();
    const store = new ReportUploadStore({
        xhr: () => xhr,
        csrf: () => 'synthetic',
        confirm: () =>
            new Promise((resolve) => {
                complete = resolve;
            }),
    });
    store.setScope('scope');
    const body = new FormData();
    body.set('submission_key', receiptKey);
    store.start('scope', '/employee/reports', body);
    xhr.onerror();
    await settle();
    t.mock.timers.tick(10000);
    assert.equal(store.getSnapshot().status, 'error');
    complete({ id: 9, source_version: 1, status: 'ready' });
    await settle();
    assert.equal(store.getSnapshot().status, 'error');
    store.retry();
    assert.equal(xhr.body, body);
});

await test('receipt lookups contain only validated keys/version and never media or foreign targets', () => {
    const body = new FormData();
    body.set('submission_key', receiptKey);
    body.set('audio', new Blob(['synthetic']), 'voice.m4a');
    const url = receiptLookupUrl({
        scope: 'scope',
        url: '/employee/reports',
        body,
    });
    assert.equal(url, `/employee/upload-receipt?key=${receiptKey}`);
    assert.equal(
        receiptLookupUrl({
            scope: 'scope',
            url: 'https://foreign.example/employee/reports',
            body,
        }),
        null,
    );
    body.set('change_key', receiptKey);
    body.set('source_version', '2');
    assert.equal(
        receiptLookupUrl({
            scope: 'scope',
            url: '/employee/reports/9/amend',
            body,
        }),
        `/employee/upload-receipt?key=${receiptKey}&report_id=9&source_version=2`,
    );
});
function fixture() {
    const requests = [];
    let notices = 0;
    let csrf = 'csrf-before';
    const store = new ReportUploadStore({
        xhr: () => {
            const request = new Request();
            requests.push(request);
            return request;
        },
        csrf: () => csrf,
        received: () => notices++,
    });
    store.setScope('10:20');
    const body = new FormData();
    body.set('submission_key', 'same-synthetic-key');
    body.set(
        'audio',
        new Blob(['synthetic'], { type: 'audio/webm' }),
        'synthetic.webm',
    );
    return {
        store,
        requests,
        body,
        notices: () => notices,
        rotateCsrf: () => {
            csrf = 'csrf-after';
        },
    };
}

await test('upload lives beyond page listeners; byte completion is not server receipt', () => {
    const { store, requests, body, notices } = fixture();
    const unmountComposer = store.subscribe(() => {});
    assert.equal(store.start('10:20', '/employee/reports', body), true);
    unmountComposer();
    requests[0].upload.onprogress({
        lengthComputable: true,
        loaded: 8,
        total: 10,
    });
    assert.equal(store.getSnapshot().progress, 80);
    requests[0].upload.onload();
    assert.equal(store.getSnapshot().status, 'confirming');
    assert.equal(notices(), 0);
    requests[0].respond(201, { id: 123, status: 'submitted' });
    assert.equal(store.getSnapshot().status, 'success');
    assert.equal(store.getSnapshot().reportId, 123);
    assert.equal(notices(), 1);
});

await test('ambiguous network failure retains exact body and key; retry refreshes CSRF and no duplicate parallel send', () => {
    const { store, requests, body, rotateCsrf } = fixture();
    store.start('10:20', '/employee/reports', body);
    assert.equal(
        store.start('10:20', '/employee/reports', new FormData()),
        false,
    );
    requests[0].onerror();
    assert.equal(store.getSnapshot().status, 'error');
    assert.equal(
        store.start('10:20', '/employee/reports', new FormData()),
        false,
    );
    rotateCsrf();
    store.retry();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body, body);
    assert.equal(requests[1].body.get('submission_key'), 'same-synthetic-key');
    assert.equal(requests[1].headers['X-XSRF-TOKEN'], 'csrf-after');
    assert.equal(requests[1].headers['X-Employee-Upload-Scope'], '10:20');
    requests[1].respond(201, { id: 124 });
    store.dismiss();
    store.retry();
    assert.equal(requests.length, 2);
});

await test('changing account aborts old files and ignores stale completion/notifications', () => {
    const { store, requests, body, notices } = fixture();
    store.start('10:20', '/employee/reports', body);
    store.setScope('30:40');
    assert.equal(requests[0].aborted, true);
    requests[0].respond(201, { id: 999 });
    requests[0].upload.onprogress({
        lengthComputable: true,
        loaded: 9,
        total: 10,
    });
    assert.equal(store.getSnapshot().scope, '30:40');
    assert.equal(store.getSnapshot().status, 'idle');
    assert.equal(notices(), 0);
    store.retry();
    assert.equal(requests.length, 1);
    assert.equal(store.start('10:20', '/employee/reports', body), false);
});

await test('HTML login redirects, validation errors and invalid receipt IDs never show success', () => {
    for (const response of [
        'html',
        'validation',
        'missing-id',
        'negative-id',
        'invalid-json',
        'null-json',
    ]) {
        const { store, requests, body, notices } = fixture();
        store.start('10:20', '/employee/reports', body);
        const xhr = requests[0];
        if (response === 'html') xhr.contentType = 'text/html';
        if (response === 'null-json') xhr.respond(200, null);
        else if (response === 'validation')
            xhr.respond(422, {
                errors: { audio: ['Synthetic validation error'] },
            });
        else if (response === 'invalid-json') {
            xhr.status = 200;
            xhr.responseText = '{';
            xhr.onload();
        } else xhr.respond(200, { id: response === 'negative-id' ? -1 : null });
        assert.equal(store.getSnapshot().status, 'error', response);
        assert.equal(notices(), 0, response);
    }
});

await test('amendments retain original version and change key, notification failure cannot undo server receipt', () => {
    const requests = [];
    const store = new ReportUploadStore({
        xhr: () => {
            const xhr = new Request();
            requests.push(xhr);
            return xhr;
        },
        csrf: () => 'csrf',
        received: () => {
            throw new Error('notifications denied');
        },
    });
    store.setScope('10:20');
    const body = new FormData();
    body.set('source_version', '2');
    body.set('change_key', 'same-change');
    assert.equal(store.start('10:20', '/tenants/1/reports', body), false);
    store.start('10:20', '/employee/reports/5/amend', body);
    requests[0].ontimeout();
    store.retry();
    assert.equal(requests[1].body.get('source_version'), '2');
    assert.equal(requests[1].body.get('change_key'), 'same-change');
    requests[1].respond(200, { id: 5, source_version: 3 });
    assert.equal(store.getSnapshot().status, 'success');
});
