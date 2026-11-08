import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    Copy,
    QrCode,
    ShieldCheck,
    UserPlus,
    X,
    LogOut,
    Users,
    FileText,
    CarFront,
    ChartNoAxesCombined,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmployeeProfileEditor from '@/components/employee-profile-editor';

type Props = {
    workspaces: { id: number; name: string }[];
    selectedTenant: number | null;
    employees: {
        id: number;
        name: string;
        phone: string | null;
        photoUrl: string | null;
        active: boolean;
        devices: number;
    }[];
    managerName: string;
    summary: {
        employees: number;
        reports: number;
        processing: number;
        awaitingReview: number;
    } | null;
    activation: { name: string; url: string } | null;
    canManageManagers: boolean;
    managers: { id: number; name: string; active: boolean }[];
    managerAdded: boolean;
};

export default function Team({
    workspaces,
    selectedTenant,
    employees,
    activation,
    canManageManagers,
    managers,
    managerAdded,
    managerName,
    summary,
}: Props) {
    const workspace = useForm({ name: '' });
    const employee = useForm({ name: '', phone: '' });
    const manager = useForm({ email: '', password: '' });
    const managerRemoval = useForm({ membership: '', password: '' });
    const [hiddenUrl, setHiddenUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const visible = activation && activation.url !== hiddenUrl;
    const phoneReady = activation?.url.startsWith('https://') ?? false;

    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface manager-surface mx-auto w-full max-w-6xl space-y-7"
        >
            <Head title="لوحة المدير" />
            <header className="manager-hero space-y-3">
                <Users size={34} className="text-orange-300" />
                <h1 className="text-2xl font-bold">
                    لوحة المدير · {managerName}
                </h1>
                <Button
                    variant="outline"
                    onClick={() => router.post('/logout')}
                >
                    <LogOut size={18} /> تسجيل خروج
                </Button>
                <p className="text-muted-foreground">
                    أضف الموظف وأعطه رمز QR أو رابطًا. لا يحتاج إلى بريد أو كلمة
                    مرور.
                </p>
            </header>
            {summary && (
                <section
                    aria-label="ملخص المؤسسة"
                    className="grid grid-cols-2 gap-3 md:grid-cols-4"
                >
                    {(
                        [
                            ['الموظفون النشطون', summary.employees],
                            ['التقارير', summary.reports],
                            ['قيد المعالجة', summary.processing],
                            ['بانتظار المراجعة', summary.awaitingReview],
                        ] as const
                    ).map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-3xl border border-white bg-white/80 p-5 text-slate-900 shadow-sm"
                        >
                            <p className="text-3xl font-bold">{value}</p>
                            <p>{label}</p>
                        </div>
                    ))}
                </section>
            )}
            <nav aria-label="المؤسسات" className="flex flex-wrap gap-3">
                {selectedTenant && (
                    <>
                        <Link
                            href={`/tenants/${selectedTenant}/vehicles`}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-white"
                        >
                            <CarFront size={21} /> سجل السيارات
                        </Link>
                        <Link
                            href={`/tenants/${selectedTenant}/insights`}
                            className="rounded-xl border border-teal-300 px-4 py-2 text-teal-800"
                        >
                            <ChartNoAxesCombined size={21} /> مؤشرات الفريق
                        </Link>
                    </>
                )}
                {selectedTenant && (
                    <Link
                        href={`/tenants/${selectedTenant}/reports`}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-white"
                    >
                        <FileText size={21} /> التقارير
                    </Link>
                )}
                {workspaces.map((tenant) => (
                    <Link
                        key={tenant.id}
                        href={`/tenants/${tenant.id}/team`}
                        className={`rounded-xl border px-4 py-2 ${selectedTenant === tenant.id ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                        {tenant.name}
                    </Link>
                ))}
            </nav>
            <details className="rounded-2xl border p-5">
                <summary className="cursor-pointer font-semibold">
                    إضافة مؤسسة
                </summary>
                <form
                    className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        workspace.post('/tenants', {
                            onSuccess: () => workspace.reset(),
                        });
                    }}
                >
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="workspace-name">
                            اسم المؤسسة الجديدة
                        </Label>
                        <Input
                            id="workspace-name"
                            value={workspace.data.name}
                            onChange={(event) =>
                                workspace.setData('name', event.target.value)
                            }
                            maxLength={120}
                            required
                        />
                        <InputError message={workspace.errors.name} />
                    </div>
                    <Button disabled={workspace.processing}>إنشاء مؤسسة</Button>
                </form>
            </details>
            {selectedTenant && (
                <>
                    <form
                        id="add-employee"
                        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setCopied(false);
                            employee.post(
                                `/tenants/${selectedTenant}/employees`,
                                { onSuccess: () => employee.reset() },
                            );
                        }}
                    >
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="employee-name">اسم الموظف</Label>
                            <Input
                                id="employee-name"
                                value={employee.data.name}
                                onChange={(event) =>
                                    employee.setData('name', event.target.value)
                                }
                                maxLength={120}
                                required
                            />
                            <InputError message={employee.errors.name} />
                        </div>
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="employee-phone">
                                هاتف الموظف (اختياري، مع رمز الدولة)
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
                        <Button disabled={employee.processing}>
                            <UserPlus />
                            إضافة وإصدار QR
                        </Button>
                    </form>
                    {visible && (
                        <section
                            aria-label="تفعيل هاتف الموظف"
                            className="space-y-4 rounded-2xl border-2 border-teal-600 bg-white p-6 text-slate-900"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold">
                                    تفعيل هاتف {activation.name}
                                </h2>
                                <Button
                                    variant="ghost"
                                    aria-label="إخفاء رمز التفعيل"
                                    onClick={() => setHiddenUrl(activation.url)}
                                >
                                    <X />
                                </Button>
                            </div>
                            {!phoneReady && (
                                <p
                                    role="alert"
                                    className="rounded-xl bg-amber-100 p-4 text-amber-950"
                                >
                                    هذا الرابط محلي ويعمل على الكمبيوتر فقط.
                                    لتجربة الهاتف شغّل معاينة HTTPS ثم أصدر رمزًا
                                    جديدًا.
                                </p>
                            )}
                            <QRCodeSVG
                                value={activation.url}
                                size={256}
                                marginSize={4}
                                className="mx-auto h-auto max-w-full"
                                title={`تفعيل هاتف ${activation.name}`}
                            />
                            <p>
                                امسح الرمز بهاتف الموظف، ثم اضغط زر الدخول. صالح
                                30 دقيقة ولمرة واحدة. اعرضه للموظف المقصود فقط.
                            </p>
                            <Button
                                onClick={() => {
                                    void navigator.clipboard
                                        .writeText(activation.url)
                                        .then(() => {
                                            setCopied(true);
                                            setCopyError(false);
                                        })
                                        .catch(() => setCopyError(true));
                                }}
                            >
                                <Copy />
                                {copied ? 'تم نسخ الرابط' : 'نسخ رابط التفعيل'}
                            </Button>
                            {copyError && (
                                <p role="alert">
                                    تعذّر النسخ. امسح رمز QR بالكاميرا.
                                </p>
                            )}
                            <p className="text-sm">
                                للتجربة على هذا الكمبيوتر: افتح الرابط في نافذة
                                خاصة حتى يبقى حساب المدير مفتوحًا.
                            </p>
                        </section>
                    )}
                    <section className="space-y-3">
                        <h2 className="text-xl font-bold">الموظفون</h2>
                        {employees.length === 0 && (
                            <p>أضف أول موظف لبدء تجربة التفعيل.</p>
                        )}
                        {employees.map((member) => (
                            <article
                                key={member.id}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
                            >
                                <div>
                                    {member.photoUrl && (
                                        <img
                                            src={member.photoUrl}
                                            alt={`صورة ${member.name}`}
                                            className="mb-2 h-16 w-16 rounded-full object-cover"
                                        />
                                    )}
                                    <h3 className="font-bold">{member.name}</h3>
                                    {member.phone && (
                                        <p dir="ltr">{member.phone}</p>
                                    )}
                                    <p className="text-sm text-muted-foreground">
                                        {member.active
                                            ? `أجهزة مفعّلة: ${member.devices}`
                                            : 'الوصول موقوف'}
                                    </p>
                                </div>
                                {member.active && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setCopied(false);
                                                router.post(
                                                    `/tenants/${selectedTenant}/employees/${member.id}/invite`,
                                                );
                                            }}
                                        >
                                            <QrCode />
                                            رمز جديد
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        'إلغاء دخول جميع أجهزة هذا الموظف؟ سيحتاج إلى رمز جديد.',
                                                    )
                                                )
                                                    router.post(
                                                        `/tenants/${selectedTenant}/employees/${member.id}/revoke`,
                                                    );
                                            }}
                                        >
                                            <ShieldCheck />
                                            إلغاء الأجهزة
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => {
                                                if (
                                                    window.confirm(
                                                        'إيقاف وصول الموظف وإلغاء أجهزته وروابطه؟',
                                                    )
                                                )
                                                    router.post(
                                                        `/tenants/${selectedTenant}/employees/${member.id}/revoke`,
                                                        { disable: true },
                                                    );
                                            }}
                                        >
                                            إيقاف الوصول
                                        </Button>
                                    </div>
                                )}
                                {!member.active && (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            router.post(
                                                `/tenants/${selectedTenant}/employees/${member.id}/enable`,
                                            )
                                        }
                                    >
                                        إعادة التفعيل وإصدار QR
                                    </Button>
                                )}
                                <EmployeeProfileEditor
                                    key={`profile-${member.id}`}
                                    tenant={selectedTenant}
                                    employee={member}
                                />
                                <Link
                                    href={`/tenants/${selectedTenant}/insights?employee=${member.id}`}
                                    className="rounded-xl bg-teal-50 px-4 py-2 text-teal-800"
                                >
                                    تقارير الموظف ومؤشراته حسب التاريخ ←
                                </Link>
                            </article>
                        ))}
                    </section>
                    {canManageManagers && (
                        <details className="space-y-4 rounded-xl border p-5">
                            <summary className="cursor-pointer font-bold">
                                إدارة المديرين · للمالك فقط
                            </summary>
                            <p className="mt-3 text-muted-foreground">
                                يسجّل المدير حسابه بالبريد ويؤكده أولًا، ثم أضفه
                                هنا. لا يمكن تحويل حساب موظف QR إلى مدير.
                            </p>
                            <form
                                className="mt-4 space-y-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    manager.post(
                                        `/tenants/${selectedTenant}/managers`,
                                        {
                                            onFinish: () =>
                                                manager.reset('password'),
                                            onSuccess: () => manager.reset(),
                                        },
                                    );
                                }}
                            >
                                <label className="block">
                                    بريد المدير المؤكّد
                                    <Input
                                        type="email"
                                        required
                                        value={manager.data.email}
                                        onChange={(event) =>
                                            manager.setData(
                                                'email',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="off"
                                    />
                                </label>
                                <label className="block">
                                    كلمة مرور حسابك للتأكيد
                                    <Input
                                        type="password"
                                        required
                                        value={manager.data.password}
                                        onChange={(event) =>
                                            manager.setData(
                                                'password',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="current-password"
                                    />
                                </label>
                                {Object.values(manager.errors).length > 0 && (
                                    <p role="alert" className="text-red-700">
                                        {Object.values(manager.errors).join(
                                            ' ',
                                        )}
                                    </p>
                                )}
                                <Button disabled={manager.processing}>
                                    إضافة مدير
                                </Button>
                                {managerAdded && (
                                    <p role="status" className="text-teal-700">
                                        تمت إضافة المدير.
                                    </p>
                                )}
                            </form>
                            <ul className="mt-4 space-y-2">
                                {managers.map((item) => (
                                    <li
                                        key={item.id}
                                        className="rounded-lg border p-3"
                                    >
                                        {item.name} ·{' '}
                                        {item.active ? 'نشط' : 'موقوف'}
                                    </li>
                                ))}
                            </ul>
                            <form
                                className="mt-4 space-y-3"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (
                                        window.confirm(
                                            'إيقاف صلاحية هذا المدير في هذه المؤسسة؟',
                                        )
                                    )
                                        managerRemoval.post(
                                            `/tenants/${selectedTenant}/managers/${managerRemoval.data.membership}/disable`,
                                            {
                                                onFinish: () =>
                                                    managerRemoval.reset(
                                                        'password',
                                                    ),
                                            },
                                        );
                                }}
                            >
                                <label className="block">
                                    إيقاف مدير
                                    <select
                                        required
                                        value={managerRemoval.data.membership}
                                        onChange={(event) =>
                                            managerRemoval.setData(
                                                'membership',
                                                event.target.value,
                                            )
                                        }
                                        className="block w-full rounded-lg border bg-background p-2"
                                    >
                                        <option value="">اختر المدير</option>
                                        {managers
                                            .filter((item) => item.active)
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
                                    كلمة مرور حسابك
                                    <Input
                                        type="password"
                                        required
                                        value={managerRemoval.data.password}
                                        onChange={(event) =>
                                            managerRemoval.setData(
                                                'password',
                                                event.target.value,
                                            )
                                        }
                                        autoComplete="current-password"
                                    />
                                </label>
                                {Object.values(managerRemoval.errors).length >
                                    0 && (
                                    <p role="alert" className="text-red-700">
                                        {Object.values(
                                            managerRemoval.errors,
                                        ).join(' ')}
                                    </p>
                                )}
                                <Button
                                    variant="destructive"
                                    disabled={
                                        managerRemoval.processing ||
                                        !managerRemoval.data.membership
                                    }
                                >
                                    إيقاف صلاحية المدير
                                </Button>
                            </form>
                        </details>
                    )}
                </>
            )}
        </main>
    );
}
