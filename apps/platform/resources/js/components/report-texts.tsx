import { LoaderCircle } from 'lucide-react';
import { useUiLocale } from '@/hooks/use-ui-locale';

export type TextOutput = {
    stage: string;
    payload: { text?: string; english?: string };
};
export default function ReportTexts({
    source,
    outputs,
    pending = false,
}: {
    source: string | null;
    outputs: TextOutput[];
    pending?: boolean;
}) {
    const { t } = useUiLocale();
    const original = [
        source,
        ...outputs
            .filter((output) => output.stage.startsWith('transcript:'))
            .map((output) => output.payload.text),
    ]
        .filter(Boolean)
        .join('\n\n');
    const english = outputs.find((output) => output.stage === 'translation')
        ?.payload.english;
    return (
        <section className="grid min-w-0 gap-4 md:grid-cols-2">
            <article className="min-w-0 rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-500">
                    {t('اللغة الأصلية')}
                </h2>
                {original ? (
                    <p dir="auto" className="break-words whitespace-pre-wrap">
                        {original}
                    </p>
                ) : pending ? (
                    <LoaderCircle
                        aria-label={t('جارٍ التحويل')}
                        className="animate-spin text-orange-500"
                    />
                ) : (
                    <p className="text-slate-400">—</p>
                )}
            </article>
            <article className="min-w-0 rounded-3xl border border-white bg-white/90 p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-slate-500">
                    {t('الإنجليزية')}
                </h2>
                {english ? (
                    <p
                        dir="ltr"
                        className="text-left break-words whitespace-pre-wrap"
                    >
                        {english}
                    </p>
                ) : pending ? (
                    <LoaderCircle
                        aria-label={t('جارٍ التحويل')}
                        className="animate-spin text-orange-500"
                    />
                ) : (
                    <p className="text-slate-400">—</p>
                )}
            </article>
        </section>
    );
}
