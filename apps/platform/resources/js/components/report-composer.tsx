import { router } from '@inertiajs/react';
import {
    Camera,
    CheckCircle2,
    ImagePlus,
    Mic,
    Send,
    Square,
    Trash2,
    Volume2,
    WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { speak } from '@/components/employee-guidance';

export type WorkItem = {
    id: number;
    name: string;
    kind: 'project' | 'task';
    project_id: number | null;
    active?: boolean;
};

export default function ReportComposer({
    workItems,
}: {
    workItems: WorkItem[];
}) {
    const [audio, setAudio] = useState<File | null>(null);
    const [images, setImages] = useState<File[]>([]);
    const [text, setText] = useState('');
    const [project, setProject] = useState('');
    const [task, setTask] = useState('');
    const [vehiclePlate, setVehiclePlate] = useState('');
    const [recording, setRecording] = useState(false);
    const [openingMic, setOpeningMic] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sent, setSent] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [previews, setPreviews] = useState<string[]>([]);
    const [audioUrl, setAudioUrl] = useState('');
    const key = useRef(crypto.randomUUID());
    const recorder = useRef<MediaRecorder | null>(null);
    const starting = useRef(false);
    const mounted = useRef(true);
    const stream = useRef<MediaStream | null>(null);
    const began = useRef(0);
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);
    const audioInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const values = images.map((file) => URL.createObjectURL(file));
        setPreviews(values);
        return () => values.forEach((url) => URL.revokeObjectURL(url));
    }, [images]);
    useEffect(() => {
        const url = audio ? URL.createObjectURL(audio) : '';
        setAudioUrl(url);
        return () => {
            if (url) URL.revokeObjectURL(url);
        };
    }, [audio]);
    useEffect(() => {
        const update = () => setOnline(navigator.onLine);
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
        };
    }, []);
    useEffect(() => {
        if (!recording) return;
        const interval = window.setInterval(() => {
            const elapsed = Math.floor((Date.now() - began.current) / 1000);
            setSeconds(Math.min(elapsed, 180));
            if (elapsed >= 179 && recorder.current?.state === 'recording')
                recorder.current.stop();
        }, 250);
        const hidden = () => {
            if (document.hidden && recorder.current?.state === 'recording')
                recorder.current.stop();
        };
        document.addEventListener('visibilitychange', hidden);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', hidden);
        };
    }, [recording]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (recorder.current?.state === 'recording')
                recorder.current.stop();
            stream.current?.getTracks().forEach((track) => track.stop());
        };
    }, []);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (audio || images.length || text || recording)
                event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [audio, images.length, text, recording]);

    const record = async () => {
        if (recording) {
            if (recorder.current?.state === 'recording')
                recorder.current.stop();
            return;
        }
        if (starting.current) return;
        setError('');
        setSent(false);
        if (
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === 'undefined'
        ) {
            setError(
                'التسجيل المباشر غير متاح. استخدم رفع ملف صوتي أو افتح التطبيق في Chrome عبر HTTPS.',
            );
            audioInput.current?.click();
            return;
        }
        starting.current = true;
        setOpeningMic(true);
        try {
            const microphone = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            if (!mounted.current) {
                microphone.getTracks().forEach((track) => track.stop());
                return;
            }
            stream.current = microphone;
            const type = [
                'audio/webm;codecs=opus',
                'audio/mp4',
                'audio/webm',
            ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
            const current = type
                ? new MediaRecorder(microphone, { mimeType: type })
                : new MediaRecorder(microphone);
            const chunks: Blob[] = [];
            current.ondataavailable = (event) => {
                if (event.data.size) chunks.push(event.data);
            };
            current.onstop = () => {
                const mime =
                    current.mimeType || chunks[0]?.type || 'audio/webm';
                const blob = new Blob(chunks, { type: mime });
                if (blob.size && mounted.current)
                    setAudio(
                        new File(
                            [blob],
                            mime.includes('mp4') ? 'voice.m4a' : 'voice.webm',
                            { type: mime },
                        ),
                    );
                microphone.getTracks().forEach((track) => track.stop());
                stream.current = null;
                setRecording(false);
            };
            current.onerror = () => {
                microphone.getTracks().forEach((track) => track.stop());
                setRecording(false);
                setError('تعذّر التسجيل. أعد المحاولة أو ارفع ملفًا صوتيًا.');
            };
            recorder.current = current;
            began.current = Date.now();
            setSeconds(0);
            setRecording(true);
            current.start(1000);
        } catch {
            stream.current?.getTracks().forEach((track) => track.stop());
            setError(
                'اسمح بالميكروفون من إعدادات المتصفح، أو ارفع ملفًا صوتيًا.',
            );
            speak('تعذر فتح الميكروفون. اطلب مساعدة المدير.');
        } finally {
            starting.current = false;
            if (mounted.current) setOpeningMic(false);
        }
    };

    const addImages = (files: FileList | null) => {
        if (!files) return;
        setSent(false);
        setError('');
        const next = [...images, ...Array.from(files)];
        if (
            next.length > 3 ||
            next.some((file) => file.size > 12 * 1024 * 1024)
        ) {
            setError('الحد ثلاث صور، وحتى 12MB لكل ملف.');
            return;
        }
        setImages(next);
    };

    const send = async () => {
        if (sending || recording || openingMic || !online) return;
        if (images.length && !audio) {
            setError('أضف تسجيلًا صوتيًا مع الصور. الصورة وحدها لا تُرسل.');
            speak('سجّل صوتك أولًا. الصورة مرفق اختياري مع التسجيل.');
            return;
        }
        setError('');
        setSent(false);
        setSending(true);
        const body = new FormData();
        body.set('submission_key', key.current);
        if (text.trim()) body.set('text', text.trim());
        if (audio) body.set('audio', audio);
        images.forEach((file) => body.append('images[]', file));
        if (project) body.set('project_id', project);
        if (task) body.set('task_id', task);
        if (vehiclePlate.trim()) body.set('vehicle_plate', vehiclePlate.trim());
        try {
            const csrf = document.cookie
                .split('; ')
                .find((part) => part.startsWith('XSRF-TOKEN='))
                ?.slice('XSRF-TOKEN='.length);
            const response = await fetch('/employee/reports', {
                method: 'POST',
                credentials: 'same-origin',
                body,
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrf || ''),
                },
            });
            if (
                !response.headers
                    .get('content-type')
                    ?.includes('application/json')
            )
                throw new Error('انتهى الدخول. اطلب تفعيل الهاتف من المدير.');
            const result = (await response.json()) as {
                errors?: Record<string, string[]>;
            };
            if (!response.ok)
                throw new Error(
                    response.status === 419
                        ? 'انتهت الجلسة. أعد تحميل الصفحة ثم حاول مجددًا.'
                        : Object.values(result.errors || {})
                              .flat()
                              .join(' ') ||
                              'تعذّر الإرسال. أعد المحاولة أو اطلب مساعدة المدير.',
                );
            setAudio(null);
            setImages([]);
            setText('');
            setVehiclePlate('');
            setProject('');
            setTask('');
            key.current = crypto.randomUUID();
            setSent(true);
            speak('تم إرسال التقرير بنجاح.');
            router.reload({ only: ['reports'] });
        } catch (exception) {
            setError(
                exception instanceof Error && exception.name !== 'TypeError'
                    ? exception.message
                    : 'انقطع الاتصال. ملفاتك ما زالت هنا. اضغط إرسال عند عودة الاتصال.',
            );
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="w-full space-y-5" aria-label="إرسال تقرير">
            <button
                aria-label="استمع لطريقة إرسال التقرير"
                className="mx-auto block rounded-full border p-3"
                onClick={() =>
                    speak(
                        'اضغط الميكروفون وتحدث، ثم اضغط إيقاف. الصورة اختيارية مع التسجيل ولا ترسل وحدها. اضغط السهم الأخضر لإرسال التقرير. لا تحتاج إلى مهمة أو كتابة.',
                    )
                }
            >
                <Volume2 size={32} />
            </button>
            <div className="grid grid-cols-2 gap-4">
                <button
                    disabled={sending || openingMic}
                    aria-label={recording ? 'إيقاف التسجيل' : 'تسجيل صوت'}
                    onClick={() => {
                        void record();
                    }}
                    className={`flex min-h-36 flex-col items-center justify-center gap-3 rounded-3xl p-5 text-xl font-bold text-white ${recording ? 'animate-pulse bg-red-700' : 'bg-teal-700'}`}
                >
                    {recording ? <Square size={56} /> : <Mic size={56} />}
                    {recording ? `${seconds} / 180` : 'تسجيل'}
                </button>
                <button
                    disabled={sending || recording || openingMic}
                    aria-label="التقاط صورة"
                    onClick={() => camera.current?.click()}
                    className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-3xl bg-blue-700 p-5 text-xl font-bold text-white"
                >
                    <Camera size={56} />
                    صورة
                </button>
            </div>
            <input
                ref={camera}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                    addImages(event.target.files);
                    event.target.value = '';
                }}
            />
            <input
                ref={gallery}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                    addImages(event.target.files);
                    event.target.value = '';
                }}
            />
            <input
                ref={audioInput}
                type="file"
                accept="audio/*,.webm,.m4a,.mp4"
                className="hidden"
                onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        if (file.size > 12 * 1024 * 1024)
                            setError('الملف أكبر من 12MB.');
                        else {
                            setAudio(file);
                            setSent(false);
                        }
                    }
                    event.target.value = '';
                }}
            />
            <div className="flex flex-wrap justify-center gap-3">
                <button
                    disabled={sending || recording || openingMic}
                    className="flex items-center gap-2 rounded-xl border p-3"
                    onClick={() => gallery.current?.click()}
                >
                    <ImagePlus />
                    معرض الصور
                </button>
                <button
                    disabled={sending || recording || openingMic}
                    className="rounded-xl border p-3"
                    onClick={() => audioInput.current?.click()}
                >
                    رفع صوت
                </button>
            </div>
            {audioUrl && (
                <div className="flex items-center gap-2 rounded-xl border p-3">
                    <audio controls src={audioUrl} className="min-w-0 flex-1" />
                    <button
                        aria-label="حذف التسجيل قبل الإرسال"
                        disabled={sending || recording || openingMic}
                        onClick={() => setAudio(null)}
                        className="p-3"
                    >
                        <Trash2 />
                    </button>
                </div>
            )}
            <div className="grid grid-cols-3 gap-2">
                {previews.map((url, index) => (
                    <div key={url} className="relative">
                        <img
                            src={url}
                            alt={`صورة مرفقة ${index + 1}`}
                            className="aspect-square w-full rounded-xl object-cover"
                        />
                        <button
                            aria-label={`حذف الصورة ${index + 1}`}
                            disabled={sending}
                            className="absolute top-1 right-1 rounded-full bg-white p-2 text-red-700"
                            onClick={() =>
                                setImages(
                                    images.filter(
                                        (_, position) => position !== index,
                                    ),
                                )
                            }
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
            </div>
            <details className="text-right">
                <summary className="cursor-pointer p-3 text-slate-600">
                    نص أو مهمة (اختياري)
                </summary>
                <label className="block p-2">
                    لوحة السيارة كاملة (اختياري)
                    <input
                        value={vehiclePlate}
                        onChange={(event) =>
                            setVehiclePlate(event.target.value)
                        }
                        maxLength={80}
                        disabled={sending}
                        placeholder="مثال وهمي: TEST A 123"
                        className="mt-2 block w-full rounded-xl border p-3"
                    />
                    <span className="text-sm text-slate-500">
                        المنطقة والرمز والرقم. يمكن للمدير ربط التقرير لاحقًا.
                    </span>
                </label>
                <label className="block p-2">
                    نص اختياري
                    <textarea
                        disabled={sending}
                        maxLength={10000}
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        className="mt-2 block min-h-24 w-full rounded-xl border p-3"
                    />
                </label>
                <label className="block p-2">
                    المشروع
                    <select
                        disabled={sending}
                        value={project}
                        onChange={(event) => {
                            setProject(event.target.value);
                            setTask('');
                        }}
                        className="block w-full rounded-xl border p-3"
                    >
                        <option value="">بدون مشروع</option>
                        {workItems
                            .filter((item) => item.kind === 'project')
                            .map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                    </select>
                </label>
                <label className="block p-2">
                    المهمة
                    <select
                        disabled={sending}
                        value={task}
                        onChange={(event) => setTask(event.target.value)}
                        className="block w-full rounded-xl border p-3"
                    >
                        <option value="">بدون مهمة</option>
                        {workItems
                            .filter(
                                (item) =>
                                    item.kind === 'task' &&
                                    (!project ||
                                        !item.project_id ||
                                        item.project_id === Number(project)),
                            )
                            .map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                </option>
                            ))}
                    </select>
                </label>
            </details>
            {!online && (
                <p
                    role="alert"
                    className="flex items-center justify-center gap-3 rounded-xl bg-amber-100 p-4"
                >
                    <WifiOff />
                    لا يوجد اتصال. احتفظ بالصفحة مفتوحة.
                </p>
            )}
            {error && (
                <p
                    role="alert"
                    className="rounded-xl bg-red-100 p-4 text-red-900"
                >
                    {error}
                </p>
            )}
            {sent && (
                <div
                    role="status"
                    className="flex items-center justify-center gap-3 rounded-xl bg-teal-100 p-5 text-xl text-teal-950"
                >
                    <CheckCircle2 size={40} />
                    تم الإرسال
                </div>
            )}
            <button
                disabled={
                    sending ||
                    openingMic ||
                    recording ||
                    !online ||
                    (!audio && (!text.trim() || images.length > 0))
                }
                onClick={() => {
                    void send();
                }}
                aria-label="إرسال التقرير"
                className="flex min-h-28 w-full items-center justify-center gap-5 rounded-3xl bg-teal-800 p-6 text-3xl font-bold text-white disabled:opacity-40"
            >
                <Send size={48} />
                {sending ? 'جارٍ الإرسال…' : 'إرسال'}
            </button>
            <p className="text-sm text-slate-500">
                تسجيل واحد حتى 3 دقائق، ومعه حتى ثلاث صور اختيارية. الصور تحتاج
                تسجيلًا صوتيًا. لا تُغلق الصفحة قبل تأكيد الإرسال.
            </p>
            {images.length > 0 && !audio && (
                <p
                    role="alert"
                    className="rounded-xl bg-amber-100 p-3 text-amber-950"
                >
                    🎤 أضف تسجيلًا صوتيًا لإرسال هذه الصور.
                </p>
            )}
        </section>
    );
}
