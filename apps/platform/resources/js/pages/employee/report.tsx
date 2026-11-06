import { Head, Link, router } from '@inertiajs/react';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

export default function EmployeeReport({
    report,
    media,
    outputs,
    aiMode,
}: {
    report: { id: number; source_text: string | null; status: string };
    media: { id: number; kind: string }[];
    outputs: {
        id: number;
        stage: string;
        payload: { text?: string; english?: string; summary?: string };
    }[];
    aiMode: string;
}) {
    useEffect(() => {
        if (!['submitted', 'processing'].includes(report.status)) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['report', 'outputs'] }),
            8000,
        );
        return () => window.clearInterval(timer);
    }, [report.status]);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="mx-auto min-h-svh max-w-xl space-y-6 p-6"
        >
            <Head title={`تقرير ${report.id}`} />
            <Link
                href="/employee"
                className="flex items-center gap-3 rounded-xl border p-4"
            >
                <ArrowRight />
                العودة
            </Link>
            <h1 className="text-2xl font-bold">تقريري #{report.id}</h1>
            <p>{report.source_text}</p>
            <p role="status">
                {report.status === 'ready'
                    ? 'اكتملت مراحل المعالجة'
                    : report.status === 'failed'
                      ? 'تعذّرت المعالجة؛ اطلب مساعدة المدير'
                      : 'جارٍ تجهيز النص والترجمة والتقرير…'}
            </p>
            {aiMode !== 'openai' && (
                <p className="rounded-xl bg-amber-100 p-3 text-amber-950">
                    وضع تجريبي: النصوص التالية محاكاة وليست تفريغًا أو ترجمة
                    حقيقية.
                </p>
            )}
            {outputs.map((output) => (
                <section key={output.id} className="rounded-xl border p-4">
                    <h2 className="mb-3 font-bold">
                        {output.stage.startsWith('transcript:')
                            ? '١ · النص بلغته الأصلية'
                            : output.stage === 'translation'
                              ? '٢ · الترجمة الإنجليزية'
                              : '٣ · تقرير العمل الإنجليزي'}
                    </h2>
                    <p
                        dir={
                            output.stage.startsWith('transcript:')
                                ? 'auto'
                                : 'ltr'
                        }
                        className="text-start whitespace-pre-wrap"
                    >
                        {output.payload.text ||
                            output.payload.english ||
                            output.payload.summary}
                    </p>
                </section>
            ))}
            {media.map((item) =>
                item.kind === 'image' ? (
                    <img
                        key={item.id}
                        src={`/employee/reports/${report.id}/media/${item.id}`}
                        alt="صورة التقرير"
                        className="w-full rounded-2xl"
                    />
                ) : (
                    <audio
                        key={item.id}
                        controls
                        src={`/employee/reports/${report.id}/media/${item.id}`}
                        className="w-full"
                    />
                ),
            )}
        </main>
    );
}
