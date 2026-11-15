import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeVoiceBridge } from '@/lib/native-voice-session';

export const inAndroidApp = () =>
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
export const nativeVoice = registerPlugin<NativeVoiceBridge>('WorkforceVoice');
export const nativeDevice = registerPlugin<{
    scanActivation(): Promise<{ url: string }>;
    openSettings(): Promise<void>;
}>('WorkforceDevice');

export function activationUrl(value: string, origin: string): string {
    const url = new URL(value);
    if (
        url.origin !== origin ||
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.pathname !== '/employee/activate' ||
        url.search ||
        !/^#[A-Za-z0-9]{64}$/.test(url.hash)
    )
        throw new Error('APP-QR');
    return url.href;
}

export function nativeVoiceFailure(error: unknown): string {
    const code =
        error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : '';
    if (code === 'MIC-NATIVE-DENIED')
        return 'لم يُسمح للتطبيق بالميكروفون. اسمح به من إعدادات التطبيق ثم أعد المحاولة. [MIC-NATIVE-DENIED]';
    if (code === 'MIC-NATIVE-EMPTY')
        return 'التسجيل قصير جدًا أو لا يحتوي على صوت. أعد التسجيل. [MIC-NATIVE-EMPTY]';
    return 'تعذر التسجيل داخل التطبيق. تحقق من إذن الميكروفون وأغلق المكالمات ثم أعد المحاولة. [MIC-NATIVE]';
}
