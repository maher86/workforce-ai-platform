import assert from 'node:assert/strict';
import test from 'node:test';
import {
    voiceAvailability,
    voiceFailure,
    startVoiceRecorder,
    openMicrophone,
} from '../../resources/js/lib/voice-recorder.ts';

await test('preflight distinguishes insecure origin and unavailable browser APIs', () => {
    assert.equal(voiceAvailability(false, false, false).code, 'MIC-HTTPS');
    assert.equal(voiceAvailability(true, false, true).code, 'MIC-UNSUPPORTED');
    assert.equal(voiceAvailability(true, true, false).code, 'MIC-UNSUPPORTED');
    assert.equal(voiceAvailability(true, true, true), null);
});

await test('browser mic request starts in click stack and a successful stream is left live', async () => {
    let calls = 0;
    let stops = 0;
    const stream = { getTracks: () => [{ stop: () => stops++ }] };
    const pending = openMicrophone(
        () => {
            calls++;
            return Promise.resolve(stream);
        },
        new AbortController().signal,
        100,
    );
    assert.equal(calls, 1);
    assert.equal(await pending, stream);
    assert.equal(stops, 0);
});

await test('an ignored permission prompt times out and late permission never starts or leaks recording', async () => {
    let finish;
    let stops = 0;
    const access = new Promise((resolve) => {
        finish = resolve;
    });
    const pending = openMicrophone(
        () => access,
        new AbortController().signal,
        5,
    );
    await assert.rejects(pending, { name: 'TimeoutError' });
    finish({ getTracks: () => [{ stop: () => stops++ }] });
    await Promise.resolve();
    assert.equal(stops, 1);
    assert.equal(
        voiceFailure({ name: 'TimeoutError' }, 'access').code,
        'MIC-TIMEOUT',
    );
});

await test('switching to native capture cancels waiting, disposes late streams and never asks on a cancelled request', async () => {
    let finish;
    let stops = 0;
    const controller = new AbortController();
    const pending = openMicrophone(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
        controller.signal,
        100,
    );
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    finish({ getTracks: () => [{ stop: () => stops++ }] });
    await Promise.resolve();
    assert.equal(stops, 1);
    let calls = 0;
    await assert.rejects(
        openMicrophone(() => {
            calls++;
            return Promise.resolve({});
        }, controller.signal),
        { name: 'AbortError' },
    );
    assert.equal(calls, 0);
});

await test('access errors distinguish blocked, absent and unavailable hardware without exposing raw errors', () => {
    for (const name of [
        'NotAllowedError',
        'PermissionDeniedError',
        'SecurityError',
    ])
        assert.equal(voiceFailure({ name }, 'access').code, 'MIC-ACCESS');
    for (const name of ['NotFoundError', 'DevicesNotFoundError'])
        assert.equal(voiceFailure({ name }, 'access').code, 'MIC-NOT-FOUND');
    for (const name of ['NotReadableError', 'TrackStartError', 'AbortError'])
        assert.equal(voiceFailure({ name }, 'access').code, 'MIC-DEVICE');
    assert.equal(
        voiceFailure(
            { name: 'Other', message: 'private untrusted error' },
            'access',
        ).code,
        'MIC-UNKNOWN',
    );
    assert.ok(
        !voiceFailure(
            { message: 'private untrusted error' },
            'access',
        ).message.includes('private'),
    );
    assert.equal(voiceFailure(null, 'access').code, 'MIC-UNKNOWN');
    assert.equal(
        voiceFailure({ name: 'NotAllowedError' }, 'recording').code,
        'MIC-RECORDER',
    );
});

function fakeRecorder(failure, phase = 'start', supported = true) {
    const attempts = [];
    class Recorder {
        static isTypeSupported() {
            return supported;
        }
        constructor(stream, options) {
            attempts.push(options?.mimeType ?? 'default');
            this.stream = stream;
            this.explicit = Boolean(options);
            if (this.explicit && phase === 'constructor')
                throw Object.assign(new Error('synthetic'), { name: failure });
        }
        start(timeslice) {
            assert.equal(
                this.configured,
                true,
                'handlers must be installed before start',
            );
            assert.equal(timeslice, 1000);
            if (this.explicit && phase === 'start')
                throw Object.assign(new Error('synthetic'), { name: failure });
            this.started = true;
        }
    }
    return { Recorder, attempts };
}
await test('unsupported explicit constructor or startup falls back to browser default', () => {
    for (const phase of ['constructor', 'start']) {
        const { Recorder, attempts } = fakeRecorder('NotSupportedError', phase);
        const value = startVoiceRecorder(
            {},
            (recorder) => {
                recorder.configured = true;
            },
            Recorder,
        );
        assert.equal(value.started, true);
        assert.deepEqual(attempts, ['audio/webm;codecs=opus', 'default']);
    }
});
await test('blocked recorder is not retried as a codec failure', () => {
    const { Recorder, attempts } = fakeRecorder('SecurityError');
    assert.throws(
        () =>
            startVoiceRecorder(
                {},
                (recorder) => {
                    recorder.configured = true;
                },
                Recorder,
            ),
        { name: 'SecurityError' },
    );
    assert.deepEqual(attempts, ['audio/webm;codecs=opus']);
});
await test('browser default is used when no explicit format is supported', () => {
    const { Recorder, attempts } = fakeRecorder('', '', false);
    const value = startVoiceRecorder(
        {},
        (recorder) => {
            recorder.configured = true;
        },
        Recorder,
    );
    assert.equal(value.started, true);
    assert.deepEqual(attempts, ['default']);
});
