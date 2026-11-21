import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    FileText,
    LogOut,
    Plus,
    QrCode,
    Smartphone,
    Users,
    ShieldCheck,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import EmployeeProfileEditor from '@/components/employee-profile-editor';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { useUiLocale } from '@/hooks/use-ui-locale';

type Employee = {
    id: number;
    name: string;
    phone: string | null;
    photoUrl: string | null;
    active: boolean;
    devices: number;
    deviceId: number | null;
};
type Props = {
    workspaces: { id: number; name: string }[];
    selectedTenant: number | null;
    employees: Employee[];
    activation: {
        name: string;
        url: string;
        deviceMode?: 'android' | 'browser';
    } | null;
    canManageManagers: boolean;
    managers: { id: number; name: string; active: boolean }[];
    managerAdded: boolean;
    androidDownloadUrl: string;
};

export default function Team({
    workspaces,
    selectedTenant,
    employees,
    activation,
    canManageManagers,
    managers,
    managerAdded,
    androidDownloadUrl,
}: Props) {
    const { t, locale, direction } = useUiLocale();
    const company = workspaces.find((item) => item.id === selectedTenant);
    const workspace = useForm({ name: '' });
    const employee = useForm({ name: '', phone: '', device_mode: 'android' });
    const manager = useForm({ name: '', email: '', password: '' });
    const removal = useForm({ membership: '', password: '' });
    const [showAdd, setShowAdd] = useState(employees.length === 0);
    const [search, setSearch] = useState('');
    const [hiddenUrl, setHiddenUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const visible = activation && activation.url !== hiddenUrl;
    const access = (
        url: string,
        data: Record<string, string | number | boolean> = {},
    ) => {
        if (busy) return;
        router.post(url, data, {
            preserveScroll: true,
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    };
    const activate = (person: Employee) => {
        const base = `/tenants/${selectedTenant}/employees/${person.id}`;
        if (person.deviceId) {
            if (
                !window.confirm(
                    t(
                        'سيُلغى دخول الجهاز الحالي فورًا ويصدر رمز للجهاز الجديد. هل تريد نقل الحساب؟',
                    ),
                )
            )
                return;
            access(`${base}/transfer`, {
                confirmed: true,
                expected_device_id: person.deviceId,
                device_mode: 'android',
            });
        } else access(`${base}/invite`, { device_mode: 'android' });
    };
    const matches = employees.filter((person) =>
        `${person.name} ${person.phone ?? ''}`
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
    );
    return (
        <main
            dir={direction}
            lang={locale}
            className="workforce-surface manager-surface mx-auto min-h-svh w-full max-w-6xl space-y-6 p-4 sm:p-6"
        >
            <Head
                title={
                    company
                        ? `${company.name} · ${t('الفريق')}`
                        : t('إنشاء شركتك')
                }
            />
            <header className="manager-hero flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Users className="text-orange-300" size={32} />
                    <div>
                        <p className="text-sm text-slate-300">
                            {company?.name ?? 'Workforce'}
                        </p>
                        <h1 className="text-2xl font-bold">
                            {t(company ? 'الفريق' : 'إنشاء شركتك')}
                        </h1>
                    </div>
                </div>
                <nav
                    className="flex flex-wrap items-center gap-2"
                    aria-label={t('لوحة المدير')}
                >
                    {selectedTenant && (
                        <Link
                            href={`/tenants/${selectedTenant}/reports`}
                            className="flex items-center gap-2 rounded-xl border border-white/30 px-4 py-3"
                        >
                            <FileText size={18} />
                            {t('التقارير')}
                        </Link>
                    )}
                    <ManagerLanguageSwitch className="border-white/30 text-white" />
                    <button
                        type="button"
                        aria-label={t('تسجيل الخروج')}
                        onClick={() => router.post('/logout')}
                        className="rounded-xl border border-white/30 p-3"
                    >
                        <LogOut size={20} />
                    </button>
                </nav>
            </header>
            {!selectedTenant && (
                <section className="mx-auto max-w-xl space-y-5 rounded-3xl border bg-white p-7">
                    <h2 className="text-xl font-bold">
                        {t('مساحة خاصة بشركتك')}
                    </h2>
                    <p className="text-slate-500">
                        {t('أنت المدير الأول. أنشئ الشركة ثم أضف فريقك.')}
                    </p>
                    <form
                        className="space-y-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            workspace.post('/tenants');
                        }}
                    >
                        <Label htmlFor="company-name">{t('اسم الشركة')}</Label>
                        <Input
                            id="company-name"
                            required
                            maxLength={120}
                            value={workspace.data.name}
                            onChange={(event) =>
                                workspace.setData('name', event.target.value)
                            }
                        />
                        <InputError message={workspace.errors.name} />
                        <Button disabled={workspace.processing}>
                            {t('إنشاء الشركة')}
                        </Button>
                    </form>
                </section>
            )}
            {selectedTenant && (
                <>
                    <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white bg-white/80 p-5">
                        <div>
                            <h2 className="text-xl font-bold">
                                {t('الموظفون')}{' '}
                                <span className="text-slate-400">
                                    {
                                        employees.filter((item) => item.active)
                                            .length
                                    }
                                </span>
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {t(
                                    'أضف الموظف، ثبّت التطبيق، ثم امسح رمز التفعيل داخل التطبيق.',
                                )}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <a
                                href={androidDownloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm"
                            >
                                <Smartphone size={18} />
                                {t('تنزيل تطبيق Android')}
                            </a>
                            <Button
                                type="button"
                                onClick={() => setShowAdd(!showAdd)}
                                aria-expanded={showAdd}
                            >
                                <Plus size={18} />
                                {t('إضافة موظف')}
                            </Button>
                        </div>
                    </section>
                    {showAdd && (
                        <form
                            id="add-employee"
                            className="grid gap-4 rounded-3xl border bg-white p-5 sm:grid-cols-2"
                            onSubmit={(event) => {
                                event.preventDefault();
                                employee.post(
                                    `/tenants/${selectedTenant}/employees`,
                                    {
                                        onSuccess: () => {
                                            employee.reset();
                                            setShowAdd(false);
                                        },
                                    },
                                );
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="employee-name">
                                    {t('اسم الموظف')}
                                </Label>
                                <Input
                                    id="employee-name"
                                    autoFocus
                                    required
                                    maxLength={120}
                                    value={employee.data.name}
                                    onChange={(event) =>
                                        employee.setData(
                                            'name',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={employee.errors.name} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="employee-phone">
                                    {t('رقم الهاتف مع رمز الدولة')}
                                </Label>
                                <Input
                                    id="employee-phone"
                                    type="tel"
                                    dir="ltr"
                                    placeholder="+971501234567"
                                    maxLength={16}
                                    value={employee.data.phone}
                                    onChange={(event) =>
                                        employee.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={employee.errors.phone} />
                            </div>
                            <p className="text-sm text-slate-500">
                                {t(
                                    'الهاتف للتواصل وWhatsApp لاحقًا؛ الدخول الآن عبر تطبيق Android فقط.',
                                )}
                            </p>
                            <Button disabled={employee.processing}>
                                <QrCode size={18} />
                                {t('إضافة وإظهار QR')}
                            </Button>
                        </form>
                    )}
                    {Object.keys(errors).length > 0 && !showAdd && (
                        <p
                            role="alert"
                            className="rounded-xl bg-red-50 p-4 text-red-800"
                        >
                            {Object.values(errors).join(' ')}
                        </p>
                    )}
                    <Input
                        aria-label={t('البحث بالاسم أو الهاتف')}
                        placeholder={t('البحث بالاسم أو الهاتف')}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                    <section
                        className="grid gap-4 md:grid-cols-2"
                        aria-label={t('الموظفون')}
                    >
                        {matches.map((person) => (
                            <article
                                key={person.id}
                                className="space-y-4 rounded-3xl border border-white bg-white/85 p-5 shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <Link
                                        href={`/tenants/${selectedTenant}/employees/${person.id}/reports`}
                                        className="flex min-w-0 flex-1 items-center gap-3"
                                    >
                                        {person.photoUrl ? (
                                            <img
                                                src={person.photoUrl}
                                                alt={t('صورة الموظف')}
                                                loading="lazy"
                                                className="size-16 rounded-full object-cover"
                                            />
                                        ) : (
                                            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-orange-50 text-xl font-bold text-orange-700">
                                                {person.name.slice(0, 1)}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="truncate text-lg font-bold">
                                                {person.name}
                                            </h3>
                                            {person.phone && (
                                                <p
                                                    dir="ltr"
                                                    className="text-start text-sm text-slate-500"
                                                >
                                                    {person.phone}
                                                </p>
                                            )}
                                            <p
                                                className={`mt-1 text-sm ${person.active && person.devices ? 'text-emerald-700' : 'text-slate-500'}`}
                                            >
                                                {t(
                                                    !person.active
                                                        ? 'الوصول متوقف'
                                                        : person.devices
                                                          ? 'الهاتف مرتبط'
                                                          : 'بانتظار تفعيل الهاتف',
                                                )}
                                            </p>
                                        </div>
                                    </Link>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {person.active ? (
                                        <Button
                                            variant={
                                                person.deviceId
                                                    ? 'outline'
                                                    : 'default'
                                            }
                                            disabled={busy}
                                            onClick={() => activate(person)}
                                        >
                                            <QrCode size={18} />
                                            {t(
                                                person.deviceId
                                                    ? 'نقل إلى هاتف جديد'
                                                    : 'تفعيل الهاتف',
                                            )}
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            disabled={busy}
                                            onClick={() =>
                                                access(
                                                    `/tenants/${selectedTenant}/employees/${person.id}/enable`,
                                                    { device_mode: 'android' },
                                                )
                                            }
                                        >
                                            {t('إعادة التفعيل')}
                                        </Button>
                                    )}
                                    <Link
                                        href={`/tenants/${selectedTenant}/employees/${person.id}/reports`}
                                        className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"
                                    >
                                        <FileText size={17} />
                                        {t('التقارير')}
                                    </Link>
                                </div>
                                <details className="border-t pt-3">
                                    <summary className="cursor-pointer text-sm text-slate-500">
                                        {t('تعديل الملف والوصول')}
                                    </summary>
                                    <div className="mt-4 space-y-4">
                                        <EmployeeProfileEditor
                                            tenant={selectedTenant}
                                            employee={person}
                                        />
                                        {person.active && (
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                t(
                                                                    'إلغاء دخول جميع أجهزة هذا الموظف؟ سيحتاج إلى رمز جديد.',
                                                                ),
                                                            )
                                                        )
                                                            access(
                                                                `/tenants/${selectedTenant}/employees/${person.id}/revoke`,
                                                            );
                                                    }}
                                                >
                                                    {t('إلغاء ربط الهاتف')}
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                t(
                                                                    'إيقاف وصول الموظف وإلغاء أجهزته وروابطه؟',
                                                                ),
                                                            )
                                                        )
                                                            access(
                                                                `/tenants/${selectedTenant}/employees/${person.id}/revoke`,
                                                                {
                                                                    disable: true,
                                                                },
                                                            );
                                                    }}
                                                >
                                                    {t('إيقاف الوصول')}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            </article>
                        ))}
                    </section>
                    {matches.length === 0 && (
                        <p className="p-6 text-center text-slate-500">
                            {t(
                                employees.length
                                    ? 'لا توجد نتائج'
                                    : 'أضف أول موظف للبدء.',
                            )}
                        </p>
                    )}
                    {canManageManagers && (
                        <details className="rounded-3xl border bg-white/80 p-5">
                            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
                                <ShieldCheck size={20} />
                                {t('مديرو الشركة')}
                            </summary>
                            <div className="mt-5 space-y-5">
                                <p className="text-sm text-slate-500">
                                    {t(
                                        'أنت مالك الشركة ومديرها الأول. إضافة مدير آخر اختيارية.',
                                    )}
                                </p>
                                {managerAdded && (
                                    <p
                                        role="status"
                                        className="rounded-xl bg-emerald-50 p-3 text-emerald-800"
                                    >
                                        {t(
                                            'أضيف المدير وأُرسل بريد الدخول. للحساب الجديد: تعيين كلمة المرور ثم تأكيد البريد.',
                                        )}
                                    </p>
                                )}
                                <form
                                    className="grid gap-3 sm:grid-cols-2"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        manager.post(
                                            `/tenants/${selectedTenant}/managers`,
                                            {
                                                preserveScroll: true,
                                                onSuccess: () =>
                                                    manager.reset(),
                                                onFinish: () =>
                                                    manager.reset('password'),
                                            },
                                        );
                                    }}
                                >
                                    <label className="space-y-2">
                                        {t('اسم المدير')}
                                        <Input
                                            required
                                            maxLength={120}
                                            value={manager.data.name}
                                            onChange={(event) =>
                                                manager.setData(
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        {t('بريد المدير')}
                                        <Input
                                            type="email"
                                            required
                                            dir="ltr"
                                            value={manager.data.email}
                                            onChange={(event) =>
                                                manager.setData(
                                                    'email',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        {t('كلمة مرور حسابك للتأكيد')}
                                        <Input
                                            type="password"
                                            required
                                            autoComplete="current-password"
                                            value={manager.data.password}
                                            onChange={(event) =>
                                                manager.setData(
                                                    'password',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </label>
                                    <Button
                                        className="self-end"
                                        disabled={manager.processing}
                                    >
                                        {t('إضافة مدير وإرسال الدعوة')}
                                    </Button>
                                    {Object.values(manager.errors).length >
                                        0 && (
                                        <p
                                            role="alert"
                                            className="text-red-700 sm:col-span-2"
                                        >
                                            {Object.values(manager.errors).join(
                                                ' ',
                                            )}
                                        </p>
                                    )}
                                </form>
                                {managers.length > 0 && (
                                    <form
                                        className="space-y-3 border-t pt-4"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            if (
                                                window.confirm(
                                                    t(
                                                        'إيقاف صلاحية هذا المدير في هذه المؤسسة؟',
                                                    ),
                                                )
                                            )
                                                removal.post(
                                                    `/tenants/${selectedTenant}/managers/${removal.data.membership}/disable`,
                                                    {
                                                        preserveScroll: true,
                                                        onFinish: () =>
                                                            removal.reset(
                                                                'password',
                                                            ),
                                                    },
                                                );
                                        }}
                                    >
                                        <label className="block">
                                            {t('إيقاف مدير')}
                                            <select
                                                required
                                                value={removal.data.membership}
                                                onChange={(event) =>
                                                    removal.setData(
                                                        'membership',
                                                        event.target.value,
                                                    )
                                                }
                                                className="mt-2 w-full rounded-xl border p-3"
                                            >
                                                <option value="">
                                                    {t('اختر المدير')}
                                                </option>
                                                {managers
                                                    .filter(
                                                        (item) => item.active,
                                                    )
                                                    .map((item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            {t('كلمة مرور حسابك للتأكيد')}
                                            <Input
                                                type="password"
                                                required
                                                autoComplete="current-password"
                                                value={removal.data.password}
                                                onChange={(event) =>
                                                    removal.setData(
                                                        'password',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                        </label>
                                        <Button
                                            variant="destructive"
                                            disabled={
                                                removal.processing ||
                                                !removal.data.membership
                                            }
                                        >
                                            {t('إيقاف صلاحية المدير')}
                                        </Button>
                                        {Object.values(removal.errors).length >
                                            0 && (
                                            <p
                                                role="alert"
                                                className="text-red-700"
                                            >
                                                {Object.values(
                                                    removal.errors,
                                                ).join(' ')}
                                            </p>
                                        )}
                                    </form>
                                )}
                            </div>
                        </details>
                    )}
                </>
            )}
            {visible && (
                <Dialog
                    open
                    onOpenChange={(open) => {
                        if (!open) setHiddenUrl(activation.url);
                    }}
                >
                    <DialogContent
                        dir={direction}
                        lang={locale}
                        aria-describedby="activation-description"
                        className="max-h-[90svh] overflow-y-auto rounded-3xl bg-white text-center sm:max-w-md"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <DialogTitle
                                id="activation-title"
                                className="text-xl font-bold"
                            >
                                {t('تفعيل الهاتف')} · {activation.name}
                            </DialogTitle>
                        </div>
                        {!activation.url.startsWith('https://') ? (
                            <p
                                role="alert"
                                className="rounded-xl bg-amber-50 p-4 text-amber-900"
                            >
                                {t(
                                    'يلزم رابط HTTPS يصل إليه الهاتف. اطلب تشغيل رابط الاختبار من المدير.',
                                )}
                            </p>
                        ) : (
                            <QRCodeSVG
                                value={activation.url}
                                size={240}
                                marginSize={4}
                                className="mx-auto max-w-full"
                            />
                        )}
                        <ol className="space-y-3 text-start text-sm text-slate-600">
                            <li>
                                <a
                                    href={androidDownloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold text-orange-700"
                                >
                                    1. {t('ثبّت تطبيق Android على هاتف الموظف.')}
                                </a>
                            </li>
                            <li>
                                2. {t('افتح التطبيق واضغط QR وامسح هذا الرمز.')}
                            </li>
                            <li>
                                3.{' '}
                                {t(
                                    'اضغط السهم. بعدها يفتح حساب الموظف مباشرة على هذا الهاتف.',
                                )}
                            </li>
                        </ol>
                        <DialogDescription
                            id="activation-description"
                            className="text-xs text-slate-500"
                        >
                            {t(
                                'رمز لمرة واحدة، صالح 30 دقيقة. لا تمسحه بكاميرا المتصفح.',
                            )}
                        </DialogDescription>
                        <Button
                            type="button"
                            className="w-full"
                            onClick={() => setHiddenUrl(activation.url)}
                        >
                            {t('تم')}
                        </Button>
                    </DialogContent>
                </Dialog>
            )}
        </main>
    );
}
