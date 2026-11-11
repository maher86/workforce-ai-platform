import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    Pencil,
    Trash2,
    Check,
    X,
    LockKeyhole,
    CheckCircle2,
    Clock3,
    FileAudio,
    LoaderCircle,
    TriangleAlert,
} from 'lucide-react';
import VoicePlayback from '@/components/voice-playback';
import ReportComposer from '@/components/report-composer';
import ReportTexts from '@/components/report-texts';
import type { TextOutput } from '@/components/report-texts';
export default function EmployeeReport({
    report,
    media,
    editableUntil,
    serverNow,
    textOutputs,
}: {
    report: {
        id: number;
        status: string;
        created_at: string;
        source_version: number;
        source_text: string | null;
    };
    editableUntil: string;
    serverNow: string;
    textOutputs: TextOutput[];
    media: { id: number; kind: string }[];
}) {
    const [editing, setEditing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [clock, setClock] = useState(() => Date.now());
    const offset = useRef(Date.parse(serverNow) - Date.now());
    const deletionKey = useRef(crypto.randomUUID());
    const remaining = Math.max(
        0,
        Math.ceil((Date.parse(editableUntil) - clock - offset.current) / 1000),
    );
    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);
    const remove = async () => {
        if (busy || !remaining) return;
        setBusy(true);
        setError('');
        try {
            const csrf =
                document.cookie
                    .split('; ')
                    .find((part) => part.startsWith('XSRF-TOKEN='))
                    ?.slice('XSRF-TOKEN='.length) || '';
            const response = await fetch(`/employee/reports/${report.id}`, {
                method: 'DELETE',
                credentials: 'same-origin',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrf),
                },
                body: JSON.stringify({
                    source_version: report.source_version,
                    change_key: deletionKey.current,
                }),
            });
            if (!response.ok) {
                const result = (await response.json()) as {
                    errors?: Record<string, string[]>;
                };
                throw new Error(
                    Object.values(result.errors ?? {})
                        .flat()
                        .join(' ') || 'تعذّر حذف التقرير. أعد المحاولة.',
                );
            }
            router.visit('/employee/history');
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'تعذّر الحذف. تحقق من الاتصال.',
            );
        } finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        if (editing || !['submitted', 'processing'].includes(report.status))
            return;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                router.reload({ only: ['report', 'textOutputs'] });
        }, 8000);
        return () => window.clearInterval(timer);
    }, [report.status, editing]);
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
            <section className="mb-5 space-y-4">
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {remaining > 0 ? (
                        <>
                            <button
                                type="button"
                                aria-label="تعديل الصوت والصور"
                                className="workforce-icon text-orange-600"
                                onClick={() => {
                                    setEditing(!editing);
                                    setConfirmDelete(false);
                                }}
                            >
                                <Pencil />
                            </button>
                            <span
                                dir="ltr"
                                className="text-sm text-slate-500 tabular-nums"
                                aria-label="الوقت المتبقي للتعديل"
                            >
                                {Math.floor(remaining / 60)}:
                                {String(remaining % 60).padStart(2, '0')}
                            </span>
                            <button
                                type="button"
                                aria-label="حذف التقرير"
                                className="workforce-icon text-red-600"
                                disabled={busy}
                                onClick={() => {
                                    setConfirmDelete(!confirmDelete);
                                    setEditing(false);
                                }}
                            >
                                <Trash2 />
                            </button>
                        </>
                    ) : (
                        <LockKeyhole
                            className="text-slate-400"
                            aria-label="انتهت مهلة التعديل"
                        />
                    )}
                    {confirmDelete && remaining > 0 && (
                        <>
                            <button
                                type="button"
                                aria-label="تأكيد حذف التقرير"
                                className="workforce-icon text-red-600"
                                disabled={busy}
                                onClick={() => void remove()}
                            >
                                {busy ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <Check />
                                )}
                            </button>
                            <button
                                type="button"
                                aria-label="إلغاء الحذف"
                                className="workforce-icon"
                                onClick={() => setConfirmDelete(false)}
                            >
                                <X />
                            </button>
                        </>
                    )}
                </div>
                {error && (
                    <p
                        role="alert"
                        className="rounded-xl bg-red-50 p-3 text-red-700"
                    >
                        {error}
                    </p>
                )}
                {editing && remaining > 0 && (
                    <ReportComposer
                        key={`${report.id}-${report.source_version}`}
                        edit={{
                            id: report.id,
                            source_version: report.source_version,
                            media,
                        }}
                        onSaved={() => {
                            setEditing(false);
                            router.reload();
                        }}
                    />
                )}
            </section>
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
            <ReportTexts
                source={report.source_text}
                outputs={textOutputs}
                pending={['submitted', 'processing'].includes(report.status)}
            />
            <div className="mt-5 space-y-5">
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
