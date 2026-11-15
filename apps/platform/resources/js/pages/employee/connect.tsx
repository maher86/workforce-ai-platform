import { Head } from '@inertiajs/react';
import { QrCode, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import {
    activationUrl,
    inAndroidApp,
    nativeDevice,
} from '@/lib/android-device';
export default function Connect() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const scan = async () => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const result = await nativeDevice.scanActivation();
            window.location.assign(
                activationUrl(result.url, window.location.origin),
            );
        } catch (failure) {
            const code =
                failure && typeof failure === 'object' && 'code' in failure
                    ? String(failure.code)
                    : '';
            if (code !== 'APP-QR-CANCELLED')
                setError(
                    'تعذر فتح رمز التفعيل. استخدم رمزًا جديدًا من مديرك لنفس عنوان التطبيق. [APP-QR]',
                );
        } finally {
            setBusy(false);
        }
    };
    return (
        <main
            dir="rtl"
            lang="ar"
            className="flex min-h-svh items-center justify-center bg-[#edf0f7] p-6"
        >
            <Head title="تفعيل الهاتف" />
            <div className="space-y-6 text-center">
                <button
                    type="button"
                    disabled={busy || !inAndroidApp()}
                    onClick={() => {
                        void scan();
                    }}
                    className="rounded-[2.5rem] border border-white bg-white/70 p-12 shadow-xl"
                    aria-label="اطلب من المدير رمز QR لتفعيل هاتفك"
                >
                    {busy ? (
                        <LoaderCircle
                            size={150}
                            className="animate-spin text-orange-500"
                        />
                    ) : (
                        <QrCode
                            size={150}
                            strokeWidth={1.3}
                            className="text-slate-800"
                        />
                    )}
                </button>
                {error && (
                    <p
                        role="alert"
                        className="max-w-sm rounded-2xl bg-red-50 p-4 text-red-900"
                    >
                        {error}
                    </p>
                )}
            </div>
        </main>
    );
}
