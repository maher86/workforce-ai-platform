import { Link } from '@inertiajs/react';
import { useState } from 'react';
type Change = {
    id: number;
    source_version: number;
    kind: string;
    created_at: string;
};
export type SourcePages = {
    data: Change[];
    prev_page_url: string | null;
    next_page_url: string | null;
};
function Snapshot({ change, base }: { change: Change; base: string }) {
    const [snapshot, setSnapshot] = useState<{
        source_text: string | null;
        reviews: {
            id: number;
            english_report: string;
            reason: string;
            status: string;
        }[];
        media_ids: number[];
        outputs: { stage: string; provider: string; payload: unknown }[];
    } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const load = async () => {
        if (busy || snapshot) return;
        setBusy(true);
        setError('');
        try {
            const response = await fetch(
                `${base}/source-history/${change.id}`,
                {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                },
            );
            if (
                !response.ok ||
                !response.headers
                    .get('content-type')
                    ?.includes('application/json')
            )
                throw new Error();
            setSnapshot(await response.json());
        } catch {
            setError('تعذّر تحميل النسخة السابقة. أعد المحاولة.');
        } finally {
            setBusy(false);
        }
    };
    return (
        <details
            className="rounded-2xl border bg-white p-4"
            onToggle={(event) => {
                if (event.currentTarget.open) void load();
            }}
        >
            <summary className="cursor-pointer font-semibold">
                مصادر الإصدار {change.source_version} ·{' '}
                {change.kind === 'delete' ? 'قبل الحذف' : 'قبل التعديل'} ·{' '}
                {new Date(change.created_at).toLocaleString('ar-AE', {
                    timeZone: 'Asia/Dubai',
                })}
            </summary>
            {busy && <p>جارٍ تحميل السجل…</p>}
            {error && (
                <p role="alert" className="text-red-700">
                    {error}
                    <button
                        onClick={() => void load()}
                        className="mx-3 underline"
                    >
                        إعادة المحاولة
                    </button>
                </p>
            )}
            {snapshot && (
                <div className="mt-4 space-y-4">
                    <p className="whitespace-pre-wrap">
                        {snapshot.source_text}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {snapshot.media_ids.map((id) => (
                            <a
                                key={id}
                                href={`${base}/media/${id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border px-4 py-2"
                            >
                                المصدر #{id}
                            </a>
                        ))}
                    </div>
                    {snapshot.reviews.map((review) => (
                        <article
                            key={review.id}
                            className="rounded-xl border border-orange-200 p-4"
                        >
                            <h3 className="font-bold">
                                المراجعة البشرية السابقة · {review.status}
                            </h3>
                            <p dir="ltr" className="whitespace-pre-wrap">
                                {review.english_report}
                            </p>
                            <p>{review.reason}</p>
                        </article>
                    ))}
                    {snapshot.outputs.map((output) => (
                        <article
                            key={output.stage}
                            className="rounded-xl bg-slate-50 p-4"
                        >
                            <h3 className="font-bold">
                                {output.stage} · {output.provider}
                            </h3>
                            <pre
                                dir="auto"
                                className="mt-2 overflow-x-auto text-sm whitespace-pre-wrap"
                            >
                                {JSON.stringify(output.payload, null, 2)}
                            </pre>
                        </article>
                    ))}
                </div>
            )}
        </details>
    );
}
export default function ReportSourceHistory({
    pages,
    base,
}: {
    pages: SourcePages;
    base: string;
}) {
    if (!pages.data.length) return null;
    return (
        <section className="space-y-4">
            <h2 className="text-xl font-bold">
                سجل تغييرات الموظف — الأدلة السابقة محفوظة
            </h2>
            {pages.data.map((change) => (
                <Snapshot key={change.id} change={change} base={base} />
            ))}
            <nav className="flex gap-4">
                {pages.prev_page_url && (
                    <Link href={pages.prev_page_url} preserveScroll>
                        أحدث
                    </Link>
                )}
                {pages.next_page_url && (
                    <Link href={pages.next_page_url} preserveScroll>
                        أقدم
                    </Link>
                )}
            </nav>
        </section>
    );
}
