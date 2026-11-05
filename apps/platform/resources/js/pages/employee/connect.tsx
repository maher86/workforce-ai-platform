import { Head } from '@inertiajs/react';
import { QrCode, Volume2 } from 'lucide-react';
import { speak } from '@/components/employee-guidance';

export default function Connect() {
    return (
        <main
            dir="rtl"
            lang="ar"
            className="flex min-h-svh flex-col items-center justify-center gap-8 bg-slate-50 p-6 text-center text-slate-900"
        >
            <Head title="تفعيل الهاتف" />
            <QrCode size={144} className="text-teal-700" />
            <h1 className="text-2xl font-bold">اطلب رمز التفعيل من المدير</h1>
            <button
                aria-label="استمع للتعليمات بالعربية"
                className="rounded-full border bg-white p-6"
                onClick={() =>
                    speak(
                        'اطلب من المدير تفعيل حسابك على هذا الهاتف. لا تحتاج إلى كلمة مرور.',
                    )
                }
            >
                <Volume2 size={48} />
            </button>
        </main>
    );
}
