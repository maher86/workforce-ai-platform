import assert from 'node:assert/strict';
import test from 'node:test';
import {
    startNativeVoice,
    nativeClipFile,
} from '../../resources/js/lib/native-voice-session.ts';
import { activationUrl } from '../../resources/js/lib/android-device.ts';

function fake() {
    const calls = [];
    let event;
    return {
        calls,
        emit: (id) => event({ sessionId: id }),
        start: async ({ sessionId }) => {
            calls.push(`start:${sessionId}`);
        },
        stop: async ({ sessionId }) => {
            calls.push(`stop:${sessionId}`);
            return { mime: 'audio/mp4', base64: btoa('synthetic-audio') };
        },
        cancel: async ({ sessionId }) => {
            calls.push(`cancel:${sessionId}`);
        },
        addListener: async (_, callback) => {
            event = callback;
            return { remove: async () => calls.push('remove') };
        },
    };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
await test('native Stop returns one attached file without chooser or automatic upload; duplicate stop/event does not duplicate it', async () => {
    const bridge = fake();
    const clips = [];
    const session = await startNativeVoice(
        bridge,
        'one',
        new AbortController().signal,
        (file) => clips.push(file),
        assert.fail,
    );
    assert.equal(session.state, 'recording');
    bridge.emit('other');
    assert.equal(clips.length, 0);
    session.stop();
    bridge.emit('one');
    session.stop();
    await settle();
    assert.equal(clips.length, 1);
    assert.equal(await clips[0].text(), 'synthetic-audio');
    assert.equal(clips[0].type, 'audio/mp4');
    assert.equal(session.state, 'inactive');
    assert.equal(bridge.calls.filter((call) => call === 'stop:one').length, 1);
    assert.ok(bridge.calls.includes('remove'));
});
await test('native background/maximum-duration event finalizes only the matching recording', async () => {
    const bridge = fake();
    const clips = [];
    await startNativeVoice(
        bridge,
        'one',
        new AbortController().signal,
        (file) => clips.push(file),
        assert.fail,
    );
    bridge.emit('one');
    await settle();
    assert.equal(clips.length, 1);
});
await test('cancellation during permission request disposes late grant without exposing another identity to a recording', async () => {
    const bridge = fake();
    const controller = new AbortController();
    let grant;
    bridge.start = () =>
        new Promise((resolve) => {
            grant = resolve;
        });
    const pending = startNativeVoice(
        bridge,
        'one',
        controller.signal,
        assert.fail,
        assert.fail,
    );
    await settle();
    controller.abort();
    grant();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.ok(bridge.calls.includes('cancel:one'));
    bridge.emit('one');
    await settle();
    assert.ok(!bridge.calls.includes('stop:one'));
});
await test('native invalid audio and failures cannot produce an uploadable clip', async () => {
    for (const clip of [
        { mime: 'audio/webm', base64: btoa('audio') },
        { mime: 'audio/mp4', base64: '' },
        { mime: 'audio/mp4', base64: 'not base64!' },
    ])
        assert.throws(() => nativeClipFile(clip));
    const bridge = fake();
    const failures = [];
    bridge.stop = async () => {
        throw new Error('native-stop');
    };
    const session = await startNativeVoice(
        bridge,
        'one',
        new AbortController().signal,
        assert.fail,
        (e) => failures.push(e),
    );
    session.stop();
    await settle();
    assert.equal(failures.length, 1);
    assert.ok(bridge.calls.includes('remove'));
});
await test('QR activation rejects external origins, passwords, wrong paths, queries and persistent credential forms', () => {
    const token = 'a'.repeat(64);
    const origin = 'https://workforce.example';
    assert.equal(
        activationUrl(`${origin}/employee/activate#${token}`, origin),
        `${origin}/employee/activate#${token}`,
    );
    for (const value of [
        `https://other.example/employee/activate#${token}`,
        `${origin}/employee#${token}`,
        `${origin}/employee/activate?token=${token}`,
        `${origin}/employee/activate#short`,
        `http://workforce.example/employee/activate#${token}`,
        `https://user@workforce.example/employee/activate#${token}`,
    ])
        assert.throws(() => activationUrl(value, origin));
});
