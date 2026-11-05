import { Head, Link, router, useForm } from '@inertiajs/react';
import { Copy, QrCode, ShieldCheck, UserPlus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
    workspaces: { id: number; name: string }[];
    selectedTenant: number | null;
    employees: { id: number; name: string; active: boolean; devices: number }[];
    activation: { name: string; url: string } | null;
};

export default function Team({
    workspaces,
    selectedTenant,
    employees,
    activation,
}: Props) {
    const workspace = useForm({ name: '' });
    const employee = useForm({ name: '' });
    const [hiddenUrl, setHiddenUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);
    const visible = activation && activation.url !== hiddenUrl;
    const phoneReady = activation?.url.startsWith('https://') ?? false;

    return (
        <main
            dir="rtl"
            lang="ar"
            className="mx-auto w-full max-w-4xl space-y-8 p-6"
        >
            <Head title="الفريق ودخول الموظفين" />
            <header className="space-y-2">
                <h1 className="text-2xl font-bold">الفريق ودخول الموظفين</h1>
                <p className="text-muted-foreground">
                    أضف الموظف وأعطه رمز QR أو رابطًا. لا يحتاج إلى بريد أو كلمة
                    مرور.
                </p>
            </header>
            <nav aria-label="المؤسسات" className="flex flex-wrap gap-3">
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
                    <Label htmlFor="workspace-name">اسم المؤسسة الجديدة</Label>
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
            {selectedTenant && (
                <>
                    <form
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
                                    <h3 className="font-bold">{member.name}</h3>
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
                            </article>
                        ))}
                    </section>
                </>
            )}
        </main>
    );
}
