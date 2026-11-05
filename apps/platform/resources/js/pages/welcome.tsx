import { Head, Link } from '@inertiajs/react';
import { Camera, Mic, QrCode, ShieldCheck } from 'lucide-react';

export default function Welcome() {
    return (
        <main
            dir="rtl"
            lang="ar"
            className="min-h-svh bg-slate-50 text-slate-900"
        >
            <Head title="تقارير العمل بالصوت والصورة" />
            <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-6">
                <span className="text-xl font-bold text-teal-800">
                    Workforce
                </span>
                <Link
                    href="/login"
                    className="rounded-xl border bg-white px-5 py-3"
                >
                    دخول المدير
                </Link>
            </nav>
            <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2">
                <div className="space-y-6">
                    <h1 className="text-4xl leading-tight font-bold sm:text-5xl">
                        تقرير العمل يبدأ بصوت الموظف.
                    </h1>
                    <p className="text-xl leading-relaxed text-slate-600">
                        يسجّل الموظف ما عمله، ويضيف الصور، ويرسل التقرير. يراجع
                        المدير المصادر والترجمة الإنجليزية قبل الاعتماد.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/register"
                            className="rounded-xl bg-teal-800 px-6 py-4 font-bold text-white"
                        >
                            إنشاء حساب مدير
                        </Link>
                        <Link
                            href="/employee/connect"
                            className="flex items-center gap-3 rounded-xl border bg-white px-6 py-4"
                        >
                            <QrCode />
                            دخول الموظف عبر QR
                        </Link>
                    </div>
                    <p className="text-slate-500">
                        الموظف لا يحتاج إلى بريد أو كلمة مرور أو مهمة محددة.
                    </p>
                </div>
                <div className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
                    {[
                        {
                            icon: Mic,
                            title: 'تحدث بطريقتك',
                            body: 'تسجيل صوتي حتى ثلاث دقائق، مع رفع ملف صوتي عند الحاجة.',
                        },
                        {
                            icon: Camera,
                            title: 'أضف ما يدعم التقرير',
                            body: 'الصور أدلة داعمة؛ الكميات والإكمال يحتاجان إلى مصدر صريح ومراجعة.',
                        },
                        {
                            icon: ShieldCheck,
                            title: 'راجع قبل الاعتماد',
                            body: 'مصادر أصلية، ترجمة منفصلة، إصدارات مراجعة وملفات خاصة بكل مؤسسة.',
                        },
                    ].map(({ icon: Icon, title, body }) => (
                        <article
                            key={title}
                            className="flex gap-4 rounded-2xl bg-slate-50 p-5"
                        >
                            <Icon
                                className="shrink-0 text-teal-700"
                                size={36}
                            />
                            <div>
                                <h2 className="mb-2 text-lg font-bold">
                                    {title}
                                </h2>
                                <p className="leading-relaxed text-slate-600">
                                    {body}
                                </p>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
            <footer className="mx-auto max-w-6xl px-6 pb-10 text-sm text-slate-500">
                معاينة تطوير ببيانات وهمية. حالة المحاكاة أو الاتصال بـAI موضّحة
                داخل الحساب.
            </footer>
        </main>
    );
}
