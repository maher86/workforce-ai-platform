import { Head } from '@inertiajs/react';
import { QrCode, LoaderCircle, Camera, CircleHelp } from 'lucide-react';
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
        if (!inAndroidApp()) {
            setError(
                'المسح المباشر متاح داخل تطبيق Android المثبّت. إذا كنت داخل التطبيق وظهرت هذه الرسالة، أرسل رمز الخطأ للمدير. في المتصفح استخدم كاميرا الهاتف لمسح رمز المدير. [APP-NATIVE-BRIDGE]',
            );
            return;
        }
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
                    disabled={busy}
                    onClick={() => {
                        void scan();
                    }}
                    className="relative rounded-[2.5rem] border-4 border-white bg-orange-500 p-12 text-white shadow-xl transition-transform focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-orange-500 active:scale-95 disabled:opacity-60"
                    aria-label="اضغط لفتح الكاميرا ومسح رمز تفعيل الموظف من المدير"
                >
                    {busy ? (
                        <LoaderCircle size={150} className="animate-spin" />
                    ) : (
                        <QrCode size={150} strokeWidth={1.3} />
                    )}
                    {!busy && (
                        <span
                            className="absolute -right-4 -bottom-4 rounded-full border-4 border-[#edf0f7] bg-white p-4 text-orange-600 shadow-lg"
                            aria-hidden="true"
                        >
                            <Camera size={36} />
                        </span>
                    )}
                </button>
                <details className="mx-auto max-w-sm rounded-2xl bg-white/70 p-4 text-slate-800">
                    <summary
                        aria-label="مساعدة المدير في تفعيل التطبيق"
                        className="flex cursor-pointer list-none justify-center"
                    >
                        <CircleHelp size={28} />
                    </summary>
                    <p className="mt-3 leading-7">
                        هذه شاشة تفعيل الهاتف. اضغط الزر البرتقالي لفتح
                        الكاميرا، ثم امسح رمز تفعيل جديدًا من صفحة الفريق عند
                        المدير. بعد التفعيل يفتح حساب الموظف مباشرة عند تشغيل
                        التطبيق.
                    </p>
                </details>
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
