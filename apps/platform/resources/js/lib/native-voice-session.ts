export type NativeClip = { base64: string; mime: string };
export type NativeVoiceBridge = {
    start(options: { sessionId: string }): Promise<void>;
    stop(options: { sessionId: string }): Promise<NativeClip>;
    cancel(options: { sessionId: string }): Promise<void>;
    addListener(
        event: 'recordingStopped',
        callback: (event: { sessionId: string }) => void,
    ): Promise<{ remove(): Promise<void> }>;
};

export function nativeClipFile(clip: NativeClip): File {
    if (
        clip.mime !== 'audio/mp4' ||
        !clip.base64 ||
        clip.base64.length > 16 * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(clip.base64)
    )
        throw new Error('MIC-NATIVE-FILE');
    const binary = atob(clip.base64);
    if (!binary.length || binary.length > 12 * 1024 * 1024)
        throw new Error('MIC-NATIVE-FILE');
    const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
    return new File([bytes], 'voice.m4a', { type: 'audio/mp4' });
}

// One recording, no persistent JS media. Ignore late native permission/results after cancellation.
export async function startNativeVoice(
    bridge: NativeVoiceBridge,
    sessionId: string,
    signal: AbortSignal,
    onClip: (clip: File) => void,
    onError: (error: unknown) => void,
) {
    let live = true;
    let state: 'recording' | 'inactive' = 'inactive';
    let finishing = false;
    let listener: { remove(): Promise<void> } | undefined;
    const cleanup = () => {
        signal.removeEventListener('abort', cancel);
        void listener?.remove().catch(() => {});
    };
    const cancel = () => {
        if (!live) return;
        live = false;
        state = 'inactive';
        cleanup();
        void bridge.cancel({ sessionId }).catch(() => {});
    };
    const stop = () => {
        if (!live || finishing) return;
        finishing = true;
        state = 'inactive';
        void bridge
            .stop({ sessionId })
            .then((clip) => {
                if (live && !signal.aborted) onClip(nativeClipFile(clip));
            })
            .catch((error) => {
                if (live && !signal.aborted) onError(error);
            })
            .finally(() => {
                live = false;
                cleanup();
            });
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
        if (signal.aborted) throw new DOMException('cancelled', 'AbortError');
        listener = await bridge.addListener('recordingStopped', (event) => {
            if (event.sessionId === sessionId) stop();
        });
        if (!live || signal.aborted)
            throw new DOMException('cancelled', 'AbortError');
        await bridge.start({ sessionId });
        if (!live || signal.aborted)
            throw new DOMException('cancelled', 'AbortError');
        if (!finishing) state = 'recording';
        return {
            get state() {
                return state;
            },
            stop,
            cancel,
        };
    } catch (error) {
        cancel();
        // addListener may resolve after cancellation, so clean it again here.
        cleanup();
        throw error;
    }
}
