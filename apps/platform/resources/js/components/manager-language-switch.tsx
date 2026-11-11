import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useUiLocale } from '@/hooks/use-ui-locale';

export default function ManagerLanguageSwitch({
    className = '',
}: {
    className?: string;
}) {
    const { locale } = useUiLocale();
    const [busy, setBusy] = useState(false);
    return (
        <button
            type="button"
            disabled={busy}
            aria-label={
                locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'
            }
            onClick={() =>
                router.post(
                    '/locale',
                    { locale: locale === 'ar' ? 'en' : 'ar' },
                    {
                        preserveScroll: true,
                        onStart: () => setBusy(true),
                        onFinish: () => setBusy(false),
                    },
                )
            }
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 disabled:opacity-50 ${className}`}
        >
            <Languages size={18} />
            <span>{locale === 'ar' ? 'English' : 'العربية'}</span>
        </button>
    );
}
