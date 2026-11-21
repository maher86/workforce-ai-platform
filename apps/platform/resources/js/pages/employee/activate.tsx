import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, QrCode, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiLocale } from '@/hooks/use-ui-locale';
import { hasNativeIdentity, nativeIdentity } from '@/lib/android-identity';

const content = {
    ar: {
        title: 'فتح حساب الموظف',
        preparing: 'جارٍ تجهيز ملفك',
        failed: 'تعذّر فتح ملفك',
        retry: 'إعادة المحاولة',
        scan: 'مسح رمز جديد',
        current: 'فتح الحساب الحالي',
        employee:
            'الهاتف مرتبط بحساب موظف بالفعل. افتح الحساب الحالي، أو اطلب مساعدة المدير لتفعيل موظف آخر.',
        manager:
            'يوجد حساب مدير مفتوح. افتح الرمز على هاتف الموظف، أو اخرج من حساب المدير أولًا.',
        missing: 'اطلب رمز QR جديدًا من المدير.',
        device: 'تعذر إثبات هذا الجهاز. حدّث تطبيق Android أو اطلب مساعدة المدير. [DEVICE-KEY]',
        connection:
            'تعذر تأكيد التفعيل. تحقق من الاتصال ثم أعد المحاولة، أو اطلب مساعدة المدير. [ACTIVATION-CONNECTION]',
    },
    en: {
        title: 'Open employee account',
        preparing: 'Preparing your profile',
        failed: 'Could not open your profile',
        retry: 'Try again',
        scan: 'Scan a new code',
        current: 'Open current account',
        employee:
            'This phone is already linked to an employee. Open the current account, or ask your manager to activate another employee.',
        manager:
            'A manager account is open. Open this code on the employee’s phone, or sign out of the manager account first.',
        missing: 'Ask your manager for a new QR code.',
        device: 'Could not verify this device. Update the Android app or ask your manager for help. [DEVICE-KEY]',
        connection:
            'Could not confirm activation. Check your connection and try again, or ask your manager for help. [ACTIVATION-CONNECTION]',
    },
};

export default function Activate({
    existingAccount,
}: {
    existingAccount: 'employee' | 'manager' | null;
}) {
    const { locale, direction } = useUiLocale();
    const copy = locale === 'en' ? content.en : content.ar;
    const [token] = useState(() => window.location.hash.slice(1));
    const validToken = /^[a-zA-Z0-9]{64}$/.test(token);
    const [preparing, setPreparing] = useState(false);
    const mounted = useRef(true);
    const attempted = useRef(false);
    const inFlight = useRef(false);
    const form = useForm<{
        token: string;
        account?: string;
        public_key?: string;
        signature?: string;
    }>({ token });

    const activate = useCallback(async () => {
        if (existingAccount || !validToken || inFlight.current) return;
        inFlight.current = true;
        setPreparing(true);
        form.clearErrors();
        const connectionFailure = () => {
            if (mounted.current) form.setError('token', copy.connection);
            return false;
        };
        try {
            const binding = hasNativeIdentity()
                ? await nativeIdentity.activation({ token })
                : {};
            if (!mounted.current) return;
            form.transform((data) => ({ ...data, ...binding }));
            form.post('/employee/activate', {
                onHttpException: connectionFailure,
                onNetworkError: connectionFailure,
                onFinish: () => {
                    inFlight.current = false;
                    if (mounted.current) setPreparing(false);
                },
            });
        } catch {
            inFlight.current = false;
            if (!mounted.current) return;
            setPreparing(false);
            form.setError('token', copy.device);
        }
    }, [
        copy.connection,
        copy.device,
        existingAccount,
        form,
        token,
        validToken,
    ]);

    useEffect(() => {
        mounted.current = true;
        window.history.replaceState(null, '', '/employee/activate');
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        // StrictMode, re-renders and errors must never consume the invitation twice.
        if (attempted.current || existingAccount || !validToken) return;
        attempted.current = true;
        void activate();
    }, [activate, existingAccount, validToken]);

    const error =
        form.errors.account ||
        form.errors.token ||
        (!validToken ? copy.missing : '');
    const busy = preparing || form.processing;
    return (
        <main
            dir={direction}
            lang={locale}
            className="employee-activation flex min-h-svh items-center justify-center bg-[#edf0f7] p-6 text-center text-slate-900"
        >
            <Head title={copy.title} />
            {existingAccount ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-7">
                    <ShieldCheck
                        size={64}
                        className="text-orange-500"
                        aria-hidden="true"
                    />
                    <p
                        role="alert"
                        className="rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-amber-950"
                    >
                        {copy[existingAccount]}
                    </p>
                    <Link
                        aria-label={copy.current}
                        href={
                            existingAccount === 'employee'
                                ? '/employee'
                                : '/dashboard'
                        }
                        className="employee-entry-button flex min-h-24 w-full items-center justify-center rounded-3xl bg-orange-500 p-6 text-white"
                    >
                        <ArrowRight size={48} aria-hidden="true" />
                    </Link>
                </div>
            ) : error && !busy ? (
                <div className="flex w-full max-w-sm flex-col items-center gap-6">
                    <QrCode
                        size={56}
                        className="text-orange-500"
                        aria-hidden="true"
                    />
                    <h1 className="text-xl font-semibold">{copy.failed}</h1>
                    <p
                        role="alert"
                        className="rounded-2xl bg-red-50 p-4 text-sm leading-7 text-red-900"
                    >
                        {error}
                    </p>
                    <div className="flex gap-4">
                        {validToken && (
                            <button
                                type="button"
                                onClick={() => void activate()}
                                aria-label={copy.retry}
                                title={copy.retry}
                                className="employee-entry-button rounded-2xl bg-orange-500 p-5 text-white"
                            >
                                <RotateCcw size={30} aria-hidden="true" />
                            </button>
                        )}
                        <Link
                            href="/employee/connect"
                            aria-label={copy.scan}
                            title={copy.scan}
                            className="employee-entry-button rounded-2xl border border-slate-200 bg-white p-5 text-slate-700"
                        >
                            <QrCode size={30} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            ) : (
                <div
                    className="activation-preparing"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <div className="activation-wave-orbit" aria-hidden="true">
                        <div className="activation-wave">
                            {Array.from({ length: 9 }, (_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        height: [
                                            20, 34, 48, 64, 76, 64, 48, 34, 20,
                                        ][i],
                                        animationDelay: `${i * -110}ms`,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                    <h1>{copy.preparing}</h1>
                </div>
            )}
        </main>
    );
}
