import { Head, Link, router } from '@inertiajs/react';
import { useEffect } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Clock3,
    FileAudio,
    LoaderCircle,
    TriangleAlert,
} from 'lucide-react';
import VoicePlayback from '@/components/voice-playback';
export default function EmployeeReport({
    report,
    media,
}: {
    report: { id: number; status: string; created_at: string };
    media: { id: number; kind: string }[];
}) {
    useEffect(() => {
        if (!['submitted', 'processing'].includes(report.status)) return;
        const timer = window.setInterval(
            () => router.reload({ only: ['report'] }),
            8000,
        );
        return () => window.clearInterval(timer);
    }, [report.status]);
    return (
        <main
            dir="rtl"
            lang="ar"
            className="workforce-surface employee-surface min-h-svh p-5"
        >
            <Head title={`تقرير ${report.id}`} />
            <header className="mb-8 flex items-center justify-between">
                <Link
                    href="/employee"
                    className="workforce-icon"
                    aria-label="العودة لتقاريري"
                >
                    <ArrowRight />
                </Link>
                <span className="flex items-center gap-3 font-bold text-slate-700">
                    <FileAudio className="text-orange-500" />#{report.id}
                </span>
                <span role="status" aria-label={report.status}>
                    {report.status === 'ready' ? (
                        <CheckCircle2 className="text-emerald-600" />
                    ) : report.status === 'failed' ? (
                        <TriangleAlert className="text-red-600" />
                    ) : (
                        <LoaderCircle className="animate-spin text-orange-500" />
                    )}
                </span>
            </header>
            <div className="mb-5 flex items-center justify-center gap-2 text-sm text-slate-500 tabular-nums">
                <Clock3 size={16} />
                {new Date(report.created_at).toLocaleString('en-GB', {
                    timeZone: 'Asia/Dubai',
                })}
            </div>
            {report.status === 'failed' && (
                <p
                    role="alert"
                    className="mb-5 rounded-2xl bg-red-50 p-4 text-red-800"
                >
                    تعذّرت معالجة التقرير؛ يمكن للمدير مراجعة المصادر وإعادة
                    المحاولة.
                </p>
            )}
            <div className="space-y-5">
                {media
                    .filter((item) => item.kind === 'audio')
                    .map((item) => (
                        <VoicePlayback
                            key={item.id}
                            src={`/employee/reports/${report.id}/media/${item.id}`}
                        />
                    ))}
                <div className="grid grid-cols-2 gap-3">
                    {media
                        .filter((item) => item.kind === 'image')
                        .map((item) => (
                            <a
                                key={item.id}
                                href={`/employee/reports/${report.id}/media/${item.id}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <img
                                    src={`/employee/reports/${report.id}/media/${item.id}`}
                                    alt="صورة التقرير"
                                    className="aspect-square w-full rounded-2xl object-cover"
                                />
                            </a>
                        ))}
                </div>
            </div>
        </main>
    );
}
