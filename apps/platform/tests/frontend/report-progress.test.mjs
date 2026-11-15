import assert from 'node:assert/strict';
import test from 'node:test';
import {
    ReportProgressStore,
    readReportProgress,
    reportIndicator,
} from '../../resources/js/lib/report-progress.ts';

await test('earlier failure or withdrawal cannot turn a new upload, processing or ready circle red', () => {
    const old = [
        { id: 1, source_version: 1, status: 'failed' },
        { id: 2, source_version: 1, status: 'withdrawn' },
    ];
    assert.equal(
        reportIndicator({ status: 'uploading', reportId: null }, old).state,
        'uploading',
    );
    assert.equal(
        reportIndicator({ status: 'confirming', reportId: null }, old).state,
        'confirming',
    );
    const reports = [
        ...old,
        { id: 3, source_version: 1, status: 'processing' },
    ];
    assert.equal(
        reportIndicator({ status: 'success', reportId: 3 }, reports).state,
        'processing',
    );
    reports[2].status = 'ready';
    const result = reportIndicator({ status: 'success', reportId: 3 }, reports);
    assert.equal(result.state, 'ready');
    assert.equal(result.priorFailures, 1);
    assert.equal(reports[0].status, 'failed'); // Diagnostics are not erased or relabelled.
});

await test('current send failure remains red; received/missing/offline state never manufactures a green check', () => {
    const reports = [{ id: 4, source_version: 1, status: 'ready' }];
    assert.equal(
        reportIndicator({ status: 'error', reportId: null }, reports).state,
        'failed',
    );
    assert.equal(
        reportIndicator({ status: 'success', reportId: 5 }, reports).state,
        'processing',
    );
    reports.push({ id: 5, source_version: 1, status: 'failed' });
    assert.equal(
        reportIndicator({ status: 'success', reportId: 5 }, reports).state,
        'failed',
    );
    reports[1].status = 'withdrawn';
    assert.equal(
        reportIndicator({ status: 'success', reportId: 5 }, reports).state,
        'withdrawn',
    );
});

await test('amendment focuses its receipt even if it has a lower report id; polling order cannot steal focus', () => {
    const reports = [
        { id: 10, source_version: 1, status: 'failed' },
        { id: 2, source_version: 2, status: 'ready' },
    ];
    assert.equal(
        reportIndicator({ status: 'success', reportId: 2 }, reports).state,
        'ready',
    );
    assert.equal(
        reportIndicator({ status: 'idle', reportId: null }, reports).report.id,
        10,
    );
    reports.reverse();
    assert.equal(
        reportIndicator({ status: 'idle', reportId: null }, reports).report.id,
        10,
    );
});

await test('receipt is not readiness; notify once only after server ready and keep other pending reports', () => {
    let notices = 0;
    const store = new ReportProgressStore(() => notices++);
    store.setScope('employee:device');
    store.track('employee:device', {
        id: 1,
        source_version: 1,
        status: 'submitted',
    });
    store.track('employee:device', {
        id: 2,
        source_version: 1,
        status: 'processing',
    });
    assert.equal(notices, 0);
    store.update('employee:device', [
        {
            id: 1,
            source_version: 1,
            status: 'processing',
            phase: 'translating',
        },
    ]);
    assert.equal(notices, 0);
    store.update('employee:device', [
        { id: 1, source_version: 1, status: 'ready', phase: 'ready' },
    ]);
    store.update('employee:device', [
        { id: 1, source_version: 1, status: 'ready', phase: 'ready' },
    ]);
    assert.equal(notices, 1);
    assert.equal(
        store.getSnapshot().reports.find((item) => item.id === 2).status,
        'processing',
    );
    store.dismissFinished();
    assert.deepEqual(
        store.getSnapshot().reports.map((item) => item.id),
        [2],
    );
});
await test('stale account responses and old source revisions cannot complete a new recording', () => {
    let notices = 0;
    const store = new ReportProgressStore(() => notices++);
    store.setScope('first');
    store.track('first', { id: 1, source_version: 2, status: 'processing' });
    store.update('first', [{ id: 1, source_version: 1, status: 'ready' }]);
    assert.equal(store.getSnapshot().reports[0].status, 'processing');
    store.setScope('second');
    assert.equal(
        store.update('first', [{ id: 1, source_version: 2, status: 'ready' }]),
        false,
    );
    store.track('first', { id: 1, source_version: 2, status: 'ready' });
    assert.equal(store.getSnapshot().reports.length, 0);
    assert.equal(notices, 0);
});
await test('offline status is unknown, never a manufactured ready/failed result; resume cannot undo ready', () => {
    const store = new ReportProgressStore();
    store.setScope('scope');
    store.track(
        'scope',
        { id: 1, source_version: 1, status: 'submitted' },
        false,
    );
    store.disconnected('scope');
    assert.equal(store.getSnapshot().reports[0].status, 'submitted');
    assert.equal(store.getSnapshot().connectionError, true);
    assert.equal(
        store.update('scope', [
            { id: 999, source_version: 1, status: 'ready' },
        ]),
        true,
    );
    assert.equal(store.getSnapshot().reports.length, 1);
    store.update('scope', [{ id: 1, source_version: 1, status: 'ready' }]);
    store.track(
        'scope',
        { id: 1, source_version: 1, status: 'submitted' },
        false,
    );
    assert.equal(store.getSnapshot().reports[0].status, 'ready');
    store.update('scope', [{ id: 1, source_version: 1, status: 'withdrawn' }]);
    store.update('scope', [{ id: 1, source_version: 1, status: 'ready' }]);
    assert.equal(store.getSnapshot().reports[0].status, 'withdrawn');
});
await test('bad progress payloads and notification errors cannot change server truth', () => {
    const store = new ReportProgressStore(() => {
        throw new Error('notification blocked');
    });
    store.setScope('scope');
    store.track('scope', { id: 1, source_version: 1, status: 'processing' });
    for (const payload of [
        null,
        {},
        [{ id: 1, source_version: 0, status: 'ready' }],
        [{ id: 1, source_version: 1, status: 'invented' }],
    ]) {
        assert.equal(store.update('scope', payload), false);
        assert.equal(store.getSnapshot().reports[0].status, 'processing');
    }
    store.update('scope', [{ id: 1, source_version: 1, status: 'failed' }]);
    assert.equal(store.getSnapshot().reports[0].status, 'failed');
    store.update('scope', [{ id: 1, source_version: 1, status: 'ready' }]);
    assert.equal(store.getSnapshot().reports[0].status, 'ready');
    assert.equal(
        readReportProgress({
            id: 2,
            source_version: 1,
            status: 'ready',
            source_text: 'must not be retained',
        }).source_text,
        undefined,
    );
});
