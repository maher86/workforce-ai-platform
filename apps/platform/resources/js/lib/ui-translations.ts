import english from '../../../lang/en.json' with { type: 'json' };
import arabicTranslations from '../../../lang/ar.json' with { type: 'json' };

export type UiLocale = 'ar' | 'en';
const dictionary: Record<string, string> = english;
const arabic: Record<string, string> = arabicTranslations;
export function translate(
    source: string,
    locale: UiLocale,
    values: Record<string, string | number> = {},
): string {
    if (typeof source !== 'string') return '';
    const key = source.replace(/\s+/g, ' ').trim();
    const text =
        locale === 'en' ? (dictionary[key] ?? source) : (arabic[key] ?? source);
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
        String(values[name] ?? match),
    );
}
