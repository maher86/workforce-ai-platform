import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

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
            className="flex min-h-svh flex-col items-center justify-center gap-8 bg-[#edf0f7] p-6 text-center text-slate-900"
        >
            <Head title="فتح حساب الموظف" />
            <ShieldCheck
                size={72}
                className="text-orange-500"
                aria-label="تفعيل حساب الموظف"
            />
            {existingAccount ? (
                <>
                    <p
                        role="alert"
                        className="max-w-sm rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"
                    >
                        {guidance}
                    </p>
                    <Link
                        aria-label="فتح الحساب الحالي"
                        href={
                            existingAccount === 'employee'
                                ? '/employee'
                                : '/dashboard'
                        }
                        className="flex min-h-40 w-full max-w-sm items-center justify-center gap-4 rounded-3xl bg-orange-500 p-8 text-3xl font-bold text-white"
                    >
                        <ArrowRight size={64} />
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
                        className="flex min-h-40 min-w-60 items-center justify-center gap-4 rounded-3xl bg-orange-500 p-8 text-3xl font-bold text-white disabled:opacity-50"
                    >
                        <ArrowRight size={64} />
                        {form.processing && (
                            <LoaderCircle className="animate-spin" />
                        )}
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
