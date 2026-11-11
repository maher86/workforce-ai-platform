import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { translate } from '@/lib/ui-translations';

export function useUiLocale() {
    const locale = usePage().props.uiLocale === 'en' ? 'en' : 'ar';
    const direction = locale === 'ar' ? 'rtl' : 'ltr';
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dir = direction;
    }, [locale, direction]);
    return {
        locale,
        direction,
        t: (source: string, values?: Record<string, string | number>) =>
            translate(source, locale, values),
    };
}
