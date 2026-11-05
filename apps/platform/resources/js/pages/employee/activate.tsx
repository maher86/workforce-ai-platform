import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { speak } from '@/components/employee-guidance';

export default function Activate({
    existingAccount,
}: {
    existingAccount: 'employee' | 'manager' | null;
}) {
    const [token] = useState(() => window.location.hash.slice(1));
    const form = useForm<{ token: string; account?: string }>({ token });
    const guidance =
        existingAccount === 'employee'
            ? 'الهاتف مرتبط بحساب موظف بالفعل. اضغط الزر الأخضر لفتح الحساب الحالي. لتفعيل موظف آخر، اطلب مساعدة المدير.'
            : existingAccount === 'manager'
              ? 'هذا المتصفح مسجل بحساب المدير. افتح الرمز على هاتف الموظف. إذا كان هذا هاتف الموظف، اخرج من حساب المدير ثم امسح الرمز مرة أخرى.'
              : 'اضغط الزر الأخضر لفتح حسابك. إذا لم يعمل، اطلب المساعدة من المدير.';
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
                onClick={() => speak(guidance)}
            >
                <Volume2 size={36} />
            </button>
            <h1 className="text-2xl font-bold">
                {existingAccount ? 'يوجد حساب مفتوح' : 'فتح حسابي'}
            </h1>
            {existingAccount ? (
                <>
                    <p className="max-w-sm text-lg">{guidance}</p>
                    <Link
                        href={
                            existingAccount === 'employee'
                                ? '/employee'
                                : '/dashboard'
                        }
                        className="flex min-h-40 w-full max-w-sm items-center justify-center gap-4 rounded-3xl bg-teal-700 p-8 text-3xl font-bold text-white"
                    >
                        <ArrowRight size={64} />
                        {existingAccount === 'employee'
                            ? 'فتح حسابي الحالي'
                            : 'حساب المدير'}
                    </Link>
                </>
            ) : (
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
            )}
            {!existingAccount &&
                (!token || form.errors.token || form.errors.account) && (
                    <p role="alert" className="max-w-sm text-lg">
                        {form.errors.account ||
                            form.errors.token ||
                            'اطلب رمز QR جديدًا من المدير.'}
                    </p>
                )}
        </main>
    );
}
