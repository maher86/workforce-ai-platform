import { Capacitor, registerPlugin } from '@capacitor/core';
import { installDeviceTransport } from '@/lib/device-transport';
import { inAndroidApp } from '@/lib/android-device';

export const nativeIdentity = registerPlugin<{
    activation(options: {
        token: string;
    }): Promise<{ public_key: string; signature: string }>;
    authorize(options: {
        method: string;
        url: string;
    }): Promise<Record<string, string>>;
}>('WorkforceIdentity');
export const hasNativeIdentity = () =>
    inAndroidApp() && Capacitor.isPluginAvailable('WorkforceIdentity');
export function initializeDeviceTransport() {
    if (hasNativeIdentity())
        installDeviceTransport(window, window.location.origin, (options) =>
            nativeIdentity.authorize(options),
        );
}
