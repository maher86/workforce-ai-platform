import { AudioLines, Mic, Settings2, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readMicrophonePermission } from '@/lib/microphone-permission';
import type { MicrophonePermission } from '@/lib/microphone-permission';
import { inAndroidApp, nativeDevice } from '@/lib/android-device';

export default function MicrophoneAccessHelp({
    onRetry,
    onUpload,
    onCapture,
    browserBusy,
    busy,
}: {
    onRetry: () => void;
    onUpload: () => void;
    onCapture: () => void;
    browserBusy: boolean;
    busy: boolean;
}) {
    const [permission, setPermission] =
        useState<MicrophonePermission>('unknown');
    const [help, setHelp] = useState(false);
    useEffect(() => {
        let active = true;
        const refresh = () => {
            void readMicrophonePermission().then((state) => {
                if (active) setPermission(state);
            });
        };
        refresh();
        window.addEventListener('focus', refresh);
        return () => {
            active = false;
            window.removeEventListener('focus', refresh);
        };
    }, []);

    if (inAndroidApp())
        return (
            <section
                aria-label="مساعدة تسجيل الصوت في التطبيق"
                className="flex items-center gap-3"
            >
                <button
                    type="button"
                    disabled={busy || browserBusy}
                    onClick={onRetry}
                    aria-label="إعادة محاولة التسجيل"
                    className="workforce-action workforce-record flex-1"
                >
                    <Mic size={48} />
                </button>
                <button
                    type="button"
                    disabled={busy || browserBusy}
                    aria-label="فتح إعدادات إذن الميكروفون للتطبيق"
                    className="workforce-icon"
                    onClick={() => {
                        void nativeDevice
                            .openSettings()
                            .catch(() => setHelp(true));
                    }}
                >
                    <Settings2 />
                </button>
                {help && (
                    <p role="alert">
                        تعذر فتح الإعدادات. افتح إعدادات الهاتف، التطبيقات،
                        Workforce، أذونات الميكروفون. [APP-SETTINGS]
                    </p>
                )}
            </section>
        );
    return (
        <section
            aria-label="المساعدة في السماح بالميكروفون"
            className="space-y-4"
        >
            <div className="flex items-stretch gap-3">
                <button
                    type="button"
                    aria-label="تسجيل الصوت بمسجل الهاتف"
                    disabled={busy}
                    onClick={onCapture}
                    className="flex min-h-24 flex-1 items-center justify-center gap-4 rounded-3xl border border-orange-300 bg-gradient-to-br from-orange-400 to-orange-600 p-4 text-white shadow-md disabled:opacity-50"
                >
                    <Mic size={42} strokeWidth={1.5} />
                    <Smartphone size={27} aria-hidden="true" />
                </button>
                <div className="flex flex-col justify-center gap-3">
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="محاولة التسجيل داخل المتصفح"
                        disabled={busy || browserBusy}
                        onClick={onRetry}
                    >
                        <Mic />
                    </button>
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="إرشادات الميكروفون للمدير"
                        aria-expanded={help}
                        onClick={() => setHelp(!help)}
                    >
                        <Settings2 />
                    </button>
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="اختيار ملف صوتي بدل التسجيل المباشر"
                        disabled={busy}
                        onClick={onUpload}
                    >
                        <AudioLines />
                    </button>
                </div>
            </div>
            {help && (
                <div className="space-y-3 rounded-2xl border border-red-200 bg-white p-4 text-sm text-slate-800">
                    <p className="font-semibold">إرشادات للمدير</p>
                    <p>
                        زر التسجيل الكبير على Android يطلب مسجل الهاتف مباشرة،
                        دون تكرار طلب إذن تسجيل الموقع. دعم الالتقاط يختلف حسب
                        الهاتف وقد يظهر اختيار تطبيق أو ملفات. استخدم أيقونة
                        الميكروفون الصغيرة هنا للتسجيل داخل المتصفح. التطبيق لا
                        يستطيع تجاوز حظر الميكروفون في النظام أو تثبيت مسجل
                        تلقائيًا.
                    </p>
                    {permission === 'denied' ? (
                        <p>
                            المتصفح يبلغ أن الوصول محظور للموقع أو بسبب سياسة.
                            زر الطلب لا يستطيع إزالة هذا الحظر؛ يلزم السماح من
                            إعدادات Chrome أو الهاتف.
                        </p>
                    ) : permission === 'granted' ? (
                        <p>
                            المتصفح يبلغ أن الإذن مسموح، لكن ذلك لا يضمن أن الهاتف
                            أتاح جهاز الميكروفون. أعد المحاولة بالزر، ثم تحقق من
                            إذن Android ومفتاح الوصول إلى الميكروفون إذا استمر
                            الخطأ.
                        </p>
                    ) : (
                        <p>
                            اضغط زر الميكروفون البرتقالي، ثم اختر «السماح» إذا
                            ظهر طلب Chrome. إذا لم يظهر الطلب، راجع حظر الموقع
                            والإذن في الهاتف.
                        </p>
                    )}
                    <ol className="list-inside list-decimal space-y-2">
                        <li>
                            افتح نفس رابط التطبيق في Chrome، ثم رمز إعدادات
                            الموقع بجانب العنوان ← الأذونات ← الميكروفون ←
                            السماح.
                        </li>
                        <li>
                            إذا لم يعمل: إعدادات الهاتف ← التطبيقات ← Chrome ←
                            الأذونات ← الميكروفون ← السماح أثناء الاستخدام. تحقق
                            أيضًا من مفتاح الوصول إلى الميكروفون العام إن وجد.
                        </li>
                        <li>
                            ارجع للتطبيق واضغط زر الطلب مرة أخرى. لا تمسح بيانات
                            الموقع حتى لا تفقد تفعيل الموظف أو ملفات غير مرسلة.
                        </li>
                    </ol>
                    <p
                        dir="ltr"
                        className="rounded-xl bg-slate-50 p-2 text-xs break-all"
                    >
                        {window.location.origin}
                    </p>
                </div>
            )}
        </section>
    );
}
