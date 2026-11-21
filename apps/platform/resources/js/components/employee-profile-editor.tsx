import { useUiLocale } from '@/hooks/use-ui-locale';
import { useForm } from '@inertiajs/react';
import { UserRoundPen, Save } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export default function EmployeeProfileEditor({
    tenant,
    employee,
}: {
    tenant: number;
    employee: { id: number; name: string; phone: string | null };
}) {
    const { t, direction, locale } = useUiLocale();

    const form = useForm<{ name: string; phone: string; photo: File | null }>({
        name: employee.name,
        phone: employee.phone || '',
        photo: null,
    });
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="gap-2 rounded-xl border-slate-200 bg-white text-slate-700"
                >
                    <UserRoundPen size={18} aria-hidden="true" />
                    {t('تحديث الملف')}
                </Button>
            </DialogTrigger>
            <DialogContent
                dir={direction}
                lang={locale}
                className="flex max-h-[90svh] flex-col gap-0 overflow-hidden rounded-3xl bg-white p-0"
            >
                <div className="shrink-0 space-y-2 border-b border-slate-100 px-12 py-5">
                    <DialogTitle className="flex items-center gap-2">
                        <UserRoundPen
                            size={22}
                            className="text-orange-500"
                            aria-hidden="true"
                        />
                        {t('تحديث الملف')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('حدّث اسم الموظف ورقم هاتفه وصورته.')}{' '}
                        <b className="text-slate-700">{employee.name}</b>
                    </DialogDescription>
                </div>
                <form
                    className="manager-modal-scroll min-h-0 space-y-4 overflow-y-auto px-6 py-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.post(
                            `/tenants/${tenant}/employees/${employee.id}/profile`,
                            {
                                forceFormData: true,
                                preserveScroll: true,
                                onSuccess: () => form.reset('photo'),
                            },
                        );
                    }}
                >
                    <label className="block">
                        {' '}
                        {t('اسم الموظف')}{' '}
                        <Input
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            maxLength={120}
                            required
                        />
                    </label>
                    <InputError message={form.errors.name} />
                    <label className="block">
                        {' '}
                        {t('رقم الهاتف (اختياري، مع رمز الدولة)')}{' '}
                        <Input
                            type="tel"
                            dir="ltr"
                            placeholder="+971501234567"
                            value={form.data.phone}
                            onChange={(event) =>
                                form.setData('phone', event.target.value)
                            }
                            maxLength={16}
                        />
                    </label>
                    <InputError message={form.errors.phone} />
                    <label className="block">
                        {' '}
                        {t('صورة الملف (اختيارية، حتى 4MB)')}{' '}
                        <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) =>
                                form.setData(
                                    'photo',
                                    event.target.files?.[0] || null,
                                )
                            }
                        />
                    </label>
                    <InputError
                        message={
                            form.errors.photo ||
                            (form.errors as Record<string, string>).media
                        }
                    />
                    <Button
                        disabled={form.processing}
                        className="w-full gap-2 rounded-xl"
                    >
                        <Save size={17} aria-hidden="true" />
                        {t('حفظ الملف')}
                    </Button>
                    {form.recentlySuccessful && (
                        <p role="status">{t('تم حفظ الملف.')}</p>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    );
}
