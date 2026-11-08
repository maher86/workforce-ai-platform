import { Head } from '@inertiajs/react';
import { QrCode } from 'lucide-react';
export default function Connect() {
    return (
        <main
            dir="rtl"
            lang="ar"
            className="flex min-h-svh items-center justify-center bg-[#edf0f7] p-6"
        >
            <Head title="تفعيل الهاتف" />
            <div
                className="rounded-[2.5rem] border border-white bg-white/70 p-12 shadow-xl"
                role="img"
                aria-label="اطلب من المدير رمز QR لتفعيل هاتفك"
            >
                <QrCode
                    size={150}
                    strokeWidth={1.3}
                    className="text-slate-800"
                />
            </div>
        </main>
    );
}
