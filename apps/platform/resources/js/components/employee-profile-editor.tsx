import { useUiLocale } from '@/hooks/use-ui-locale';
import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function EmployeeProfileEditor({
    tenant,
    employee,
}: {
    tenant: number;
    employee: { id: number; name: string; phone: string | null };
}) {
    const { t } = useUiLocale();

    const form = useForm<{ name: string; phone: string; photo: File | null }>({
        name: employee.name,
        phone: employee.phone || '',
        photo: null,
    });
    return (
        <details className="w-full rounded-xl bg-slate-50 p-3 text-slate-900">
            <summary className="cursor-pointer">
                {' '}
                {t('تعديل الاسم والهاتف والصورة')}{' '}
            </summary>
            <form
                className="mt-3 space-y-3"
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
                <Button disabled={form.processing}>{t('حفظ الملف')}</Button>
                {form.recentlySuccessful && (
                    <p role="status">{t('تم حفظ الملف.')}</p>
                )}
            </form>
        </details>
    );
}
