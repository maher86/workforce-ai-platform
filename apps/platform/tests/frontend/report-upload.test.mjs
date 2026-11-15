import assert from 'node:assert/strict';
import test from 'node:test';
import { ReportUploadStore } from '../../resources/js/lib/report-upload.ts';

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
        this.responseText = JSON.stringify(result);
        this.onload();
    }
}
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
