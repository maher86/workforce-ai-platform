import { Head, useForm } from '@inertiajs/react';
import { ArrowRight, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { speak } from '@/components/employee-guidance';

export default function Activate() {
    const [token] = useState(() => window.location.hash.slice(1));
    const form = useForm({ token });
    useEffect(() => {
        window.history.replaceState(null, '', '/employee/activate');
    }, []);

    return (
        <main
            dir="rtl"
            lang="ar"
            className="flex min-h-svh flex-col items-center justify-center gap-8 bg-slate-50 p-6 text-center text-slate-900"
        >
            <Head title="فتح حساب الموظف" />
            <button
                aria-label="استمع للتعليمات بالعربية"
                className="rounded-full border bg-white p-5"
                onClick={() =>
                    speak(
                        'اضغط الزر الأخضر لفتح حسابك. إذا لم يعمل، اطلب المساعدة من المدير.',
                    )
                }
            >
                <Volume2 size={36} />
            </button>
            <h1 className="text-2xl font-bold">فتح حسابي</h1>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/employee/activate');
                }}
            >
                <button
                    aria-label="فتح حسابي على هذا الهاتف"
                    disabled={!token || form.processing}
                    className="flex min-h-40 min-w-60 items-center justify-center gap-4 rounded-3xl bg-teal-700 p-8 text-3xl font-bold text-white disabled:opacity-50"
                >
                    <ArrowRight size={64} />
                    {form.processing ? '…' : 'دخول'}
                </button>
            </form>
            {(!token || form.errors.token) && (
                <p role="alert" className="max-w-sm text-lg">
                    {form.errors.token || 'اطلب رمز QR جديدًا من المدير.'}
                </p>
            )}
        </main>
    );
}
