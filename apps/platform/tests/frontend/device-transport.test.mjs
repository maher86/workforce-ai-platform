import assert from 'node:assert/strict';
import test from 'node:test';
import {
    installDeviceTransport,
    protectedDeviceTarget,
} from '../../resources/js/lib/device-transport.ts';

const origin = 'https://workforce.example';
const settle = () => new Promise((resolve) => setImmediate(resolve));
function harness(proof) {
    const sent = [];
    class Xhr extends EventTarget {
        headers = {};
        open(method, url) {
            this.url = url;
            this.method = method;
        }
        setRequestHeader(name, value) {
            this.headers[name] = value;
        }
        send(body) {
            sent.push({ url: this.url, body, headers: { ...this.headers } });
        }
        abort() {
            this.dispatchEvent(new Event('abort'));
        }
    }
    const target = {
        XMLHttpRequest: Xhr,
        fetch: async (...args) => {
            sent.push(args);
            return new Response();
        },
    };
    const restore = installDeviceTransport(target, origin, proof);
    return { target, sent, restore };
}

await test('device proof never signs foreign origins, manager pages or public clock', () => {
    for (const url of [
        'https://foreign.example/employee',
        '//foreign.example/employee',
        '/dashboard',
        '/employee-other',
        '/employee/device-clock',
        'https://user@workforce.example/employee',
    ]) {
        assert.equal(protectedDeviceTarget(url, origin), null);
    }
    assert.equal(
        protectedDeviceTarget('/employee/report-days?day=2026-11-15', origin),
        `${origin}/employee/report-days?day=2026-11-15`,
    );
});

await test('signed multipart XHR preserves exact body and upload/idempotency headers', async () => {
    const proofs = [];
    const { target, sent } = harness(async (request) => {
        proofs.push(request);
        return { 'X-Workforce-Proof': 'synthetic-proof' };
    });
    const xhr = new target.XMLHttpRequest();
    const body = new FormData();
    body.append('submission_key', 'synthetic-key');
    xhr.open('POST', '/employee/reports');
    xhr.setRequestHeader('X-Employee-Upload-Scope', 'synthetic-scope');
    xhr.send(body);
    assert.equal(sent.length, 0);
    await settle();
    assert.deepEqual(proofs, [
        { method: 'POST', url: `${origin}/employee/reports` },
    ]);
    assert.equal(sent[0].body, body);
    assert.equal(sent[0].headers['X-Employee-Upload-Scope'], 'synthetic-scope');
    assert.equal(sent[0].headers['X-Workforce-Proof'], 'synthetic-proof');
    assert.throws(() => xhr.send(body), { name: 'InvalidStateError' });
});

await test('abort or reopen while signing prevents late XHR send', async () => {
    const pending = [];
    const { target, sent } = harness(
        () => new Promise((resolve) => pending.push(resolve)),
    );
    const xhr = new target.XMLHttpRequest();
    xhr.open('POST', '/employee/reports');
    xhr.send('old');
    xhr.abort();
    pending.shift()({ 'X-Workforce-Proof': 'old' });
    await settle();
    assert.equal(sent.length, 0);
    xhr.open('POST', '/employee/reports');
    xhr.send('old-again');
    xhr.open('GET', '/employee/history');
    xhr.send();
    pending.shift()({ 'X-Workforce-Proof': 'old' });
    await settle();
    assert.equal(sent.length, 0);
    pending.shift()({ 'X-Workforce-Proof': 'new' });
    await settle();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, '/employee/history');
});

await test('proof failure emits terminal XHR error without unsigned fallback', async () => {
    const { target, sent } = harness(async () => {
        throw new Error('Keystore unavailable');
    });
    const xhr = new target.XMLHttpRequest();
    const events = [];
    for (const name of ['error', 'loadend'])
        xhr.addEventListener(name, () => events.push(name));
    xhr.open('POST', '/employee/reports');
    xhr.send('synthetic');
    await settle();
    assert.equal(sent.length, 0);
    assert.deepEqual(events, ['error', 'loadend']);
});

await test('fetch cancellation during proof prevents send; foreign requests keep original options', async () => {
    let resolveProof;
    const { target, sent, restore } = harness(
        () =>
            new Promise((resolve) => {
                resolveProof = resolve;
            }),
    );
    const controller = new AbortController();
    const result = target.fetch('/employee/reports', {
        method: 'POST',
        body: 'synthetic',
        signal: controller.signal,
    });
    controller.abort();
    resolveProof({ 'X-Workforce-Proof': 'synthetic' });
    await assert.rejects(result, { name: 'AbortError' });
    assert.equal(sent.length, 0);
    const options = { method: 'GET' };
    await target.fetch('https://foreign.example/employee', options);
    assert.equal(sent[0][1], options);
    restore();
});

await test('fetch signs Request method and retains body without copying or consuming it', async () => {
    const { target, sent } = harness(async ({ method }) => {
        assert.equal(method, 'POST');
        return { 'X-Workforce-Proof': 'synthetic' };
    });
    const request = new Request(`${origin}/employee/reports`, {
        method: 'POST',
        body: 'synthetic',
        headers: { 'X-Idempotency-Key': 'same-key' },
    });
    await target.fetch(request);
    assert.equal(sent[0][0], request);
    assert.equal(request.bodyUsed, false);
    assert.equal(sent[0][1].headers.get('X-Idempotency-Key'), 'same-key');
    assert.equal(sent[0][1].headers.get('X-Workforce-Proof'), 'synthetic');
});
