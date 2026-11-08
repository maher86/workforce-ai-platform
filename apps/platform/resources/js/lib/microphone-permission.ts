export type MicrophonePermission = 'granted' | 'prompt' | 'denied' | 'unknown';

// Permissions.query only reads permission state. It never opens the microphone.
export async function readMicrophonePermission(
    query?: () => Promise<{ state: string }>,
): Promise<MicrophonePermission> {
    try {
        if (!query) {
            if (
                typeof navigator === 'undefined' ||
                typeof navigator.permissions?.query !== 'function'
            )
                return 'unknown';
            query = () =>
                navigator.permissions.query({
                    name: 'microphone' as PermissionName,
                });
        }
        const { state } = await query();
        return state === 'granted' || state === 'prompt' || state === 'denied'
            ? state
            : 'unknown';
    } catch {
        // Unsupported permission descriptors must not prevent a normal user-click request.
        return 'unknown';
    }
}
