import { Head, Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

export default function EmployeeReport({
    report,
    media,
}: {
    report: { id: number; source_text: string | null; status: string };
    media: { id: number; kind: string }[];
}) {
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
