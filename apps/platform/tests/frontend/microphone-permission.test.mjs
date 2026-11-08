import assert from 'node:assert/strict';
import test from 'node:test';
import { readMicrophonePermission } from '../../resources/js/lib/microphone-permission.ts';

await test('permission reads preserve prompt, granted and denied without requesting a device', async () => {
    let queries = 0;
    for (const state of ['prompt', 'granted', 'denied']) {
        assert.equal(
            await readMicrophonePermission(async () => {
                queries++;
                return { state };
            }),
            state,
        );
    }
    assert.equal(queries, 3);
});

await test('unsupported/rejected permission query returns unknown instead of preventing retry', async () => {
    assert.equal(
        await readMicrophonePermission(async () => {
            throw new TypeError('Unsupported microphone descriptor');
        }),
        'unknown',
    );
    assert.equal(
        await readMicrophonePermission(async () => ({ state: 'unexpected' })),
        'unknown',
    );
    assert.equal(await readMicrophonePermission(), 'unknown');
});
