import assert from 'node:assert/strict';
import test from 'node:test';
import {
    stableRecordedAudio,
    playbackFailure,
} from '../../resources/js/lib/audio-preview.ts';

await test('recordings use actual container headers for preview and immutable bytes instead of a native provider handle', async () => {
    for (const [header, type] of [
        ['RIFF0000WAVEdata', 'audio/wav'],
        ['#!AMR\n00000000', 'audio/amr'],
        ['0000ftyp3gp5data', 'audio/3gpp'],
        ['0000ftypM4A data', 'audio/mp4'],
        ['OggS00000000', 'audio/ogg'],
    ]) {
        const source = new File([header], 'native-recording', {
            type: 'application/octet-stream',
        });
        const stable = await stableRecordedAudio(source);
        assert.notEqual(stable, source);
        assert.equal(stable.type, type);
        assert.equal(await stable.text(), header);
    }
    const webm = await stableRecordedAudio(
        new File([new Uint8Array([26, 69, 223, 163, 1, 2, 3])], 'voice', {
            type: 'audio/mp4',
        }),
    );
    assert.equal(webm.type, 'audio/webm');
});

await test('empty, oversized, unreadable and partial native selections cannot become uploadable recordings', async () => {
    await assert.rejects(
        stableRecordedAudio(new File([], 'empty')),
        /audio_size/,
    );
    await assert.rejects(
        stableRecordedAudio({
            size: 12 * 1024 * 1024 + 1,
            arrayBuffer: () => assert.fail('oversize read'),
        }),
        /audio_size/,
    );
    await assert.rejects(
        stableRecordedAudio({
            size: 10,
            arrayBuffer: async () => new ArrayBuffer(1),
        }),
        /audio_read/,
    );
    await assert.rejects(
        stableRecordedAudio({
            size: 10,
            arrayBuffer: async () => {
                throw new Error('provider access lost');
            },
        }),
    );
});

await test('unsupported local playback is not a network or microphone permission error; server validation still decides acceptance', () => {
    for (const code of [3, 4]) {
        const failure = playbackFailure(code, true);
        assert.equal(failure.code, 'VOICE-PREVIEW-FORMAT');
        assert.equal(failure.previewOnly, true);
        assert.equal(failure.message.includes('الصلاحية'), false);
        assert.equal(failure.message.includes('الاتصال'), false);
    }
    assert.equal(playbackFailure(2, true).code, 'VOICE-PREVIEW-READ');
    assert.equal(playbackFailure(2, false).code, 'VOICE-NETWORK');
    assert.equal(playbackFailure(4, false).code, 'VOICE-PLAYBACK');
    assert.equal(
        playbackFailure(undefined, true, 'NotAllowedError').code,
        'VOICE-PLAY-BLOCKED',
    );
});
