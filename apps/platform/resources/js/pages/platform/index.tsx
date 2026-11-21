import { Head, Link, router, useForm } from '@inertiajs/react';
import { Building2, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUiLocale } from '@/hooks/use-ui-locale';

type Company = { id: number; name: string; created_at: string };
export default function Platform({
    companies,
    search,
}: {
    companies: {
        data: Company[];
        links: { url: string | null; label: string; active: boolean }[];
    };
    search: string;
}) {
    const { t, locale, direction } = useUiLocale();
    const [query, setQuery] = useState(search);
    const form = useForm({ reason: '' });
    const [selected, setSelected] = useState<number | null>(null);
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh max-w-6xl space-y-6 p-5"
        >
            <Head title={t('إدارة المنصة')} />
            <header className="manager-hero flex flex-wrap items-center justify-between gap-4">
                <div>
                    <ShieldCheck className="mb-2 text-orange-300" />
                    <h1 className="text-2xl font-bold">{t('إدارة المنصة')}</h1>
                    <p className="mt-2 text-sm text-slate-300">
                        {t('حساب دعم مستقل. لا يتم تسجيل الدخول باسم العميل.')}
                    </p>
                </div>
                <div className="flex gap-3">
                    <ManagerLanguageSwitch className="border-white/30 text-white" />
                    <Button
                        variant="outline"
                        onClick={() => router.post('/logout')}
                        aria-label={t('تسجيل الخروج')}
                    >
                        <LogOut size={20} />
                    </Button>
                </div>
            </header>
            <form
                className="flex gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    router.get('/platform', { search: query });
                }}
            >
                <Input
                    aria-label={t('البحث عن شركة')}
                    placeholder={t('البحث عن شركة')}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <Button>{t('بحث')}</Button>
            </form>
            <section className="space-y-3">
                {companies.data.map((company) => (
                    <article
                        key={company.id}
                        className="rounded-3xl border bg-white p-5"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="flex items-center gap-3 text-lg font-bold">
                                <Building2 size={22} />
                                {company.name}
                            </h2>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelected(company.id);
                                    form.reset();
                                }}
                                aria-expanded={selected === company.id}
                            >
                                {t('تشخيص تقني')}
                            </Button>
                        </div>
                        {selected === company.id && (
                            <form
                                className="mt-4 space-y-3 border-t pt-4"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    form.post(
                                        `/platform/companies/${company.id}/diagnostics`,
                                    );
                                }}
                            >
                                <label className="block text-sm">
                                    {t('سبب جلسة الدعم')}
                                    <Input
                                        required
                                        minLength={10}
                                        maxLength={500}
                                        value={form.data.reason}
                                        onChange={(event) =>
                                            form.setData(
                                                'reason',
                                                event.target.value,
                                            )
                                        }
                                        placeholder={t(
                                            'رقم تذكرة أو وصف تقني، دون بيانات موظفين',
                                        )}
                                    />
                                </label>
                                <p className="text-xs text-slate-500">
                                    {t(
                                        'قراءة مؤشرات تقنية فقط لمدة 15 دقيقة، مع سجل تدقيق.',
                                    )}
                                </p>
                                {form.errors.reason && (
                                    <p role="alert" className="text-red-700">
                                        {form.errors.reason}
                                    </p>
                                )}
                                <Button disabled={form.processing}>
                                    {t('بدء التشخيص')}
                                </Button>
                            </form>
                        )}
                    </article>
                ))}
            </section>
            <nav className="flex flex-wrap gap-2">
                {companies.links.map(
                    (item, i) =>
                        item.url && (
                            <Link
                                key={i}
                                href={item.url}
                                className={`rounded-xl border px-3 py-2 ${item.active ? 'bg-slate-900 text-white' : 'bg-white'}`}
                            >
                                {item.label.replace(/&[^;]+;/g, '')}
                            </Link>
                        ),
                )}
            </nav>
        </main>
    );
}
