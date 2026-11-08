import { router } from '@inertiajs/react';
import {
    Camera,
    CheckCircle2,
    ImagePlus,
    Mic,
    Send,
    Square,
    Trash2,
    AudioLines,
    LoaderCircle,
    WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import VoicePlayback from '@/components/voice-playback';
import {
    startVoiceRecorder,
    voiceAvailability,
    voiceFailure,
} from '@/lib/voice-recorder';

export type WorkItem = {
    id: number;
    name: string;
    kind: 'project' | 'task';
    project_id: number | null;
    active?: boolean;
};

export default function ReportComposer() {
    const [audio, setAudio] = useState<File | null>(null);
    const [images, setImages] = useState<File[]>([]);
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
            if (audio || images.length || recording) event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [audio, images.length, recording]);

    const record = async () => {
        if (recording) {
            if (recorder.current?.state === 'recording')
                recorder.current.stop();
            return;
        }
        if (starting.current) return;
        setError('');
        setSent(false);
        const unavailable = voiceAvailability(
            window.isSecureContext,
            typeof navigator.mediaDevices?.getUserMedia === 'function',
            typeof MediaRecorder !== 'undefined',
        );
        if (unavailable) {
            setError(`${unavailable.message} [${unavailable.code}]`);
            return;
        }
        starting.current = true;
        setOpeningMic(true);
        let phase: 'access' | 'recording' = 'access';
        try {
            const microphone = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            if (!mounted.current) {
                microphone.getTracks().forEach((track) => track.stop());
                return;
            }
            stream.current = microphone;
            phase = 'recording';
            const current = startVoiceRecorder(microphone, (current) => {
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
                                mime.includes('mp4')
                                    ? 'voice.m4a'
                                    : 'voice.webm',
                                { type: mime },
                            ),
                        );
                    microphone.getTracks().forEach((track) => track.stop());
                    if (stream.current === microphone) stream.current = null;
                    if (mounted.current) setRecording(false);
                };
                current.onerror = (event) => {
                    current.ondataavailable = null;
                    current.onstop = null;
                    current.onerror = null;
                    microphone.getTracks().forEach((track) => track.stop());
                    if (stream.current === microphone) stream.current = null;
                    recorder.current = null;
                    if (mounted.current) {
                        setRecording(false);
                        const failure = voiceFailure(event, 'recording');
                        setError(`${failure.message} [${failure.code}]`);
                    }
                };
            });
            recorder.current = current;
            began.current = Date.now();
            setSeconds(0);
            setRecording(true);
        } catch (error) {
            stream.current?.getTracks().forEach((track) => track.stop());
            stream.current = null;
            recorder.current = null;
            if (mounted.current) {
                setRecording(false);
                const failure = voiceFailure(error, phase);
                setError(`${failure.message} [${failure.code}]`);
            }
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
            return;
        }
        setError('');
        setSent(false);
        setSending(true);
        const body = new FormData();
        body.set('submission_key', key.current);
        if (audio) body.set('audio', audio);
        images.forEach((file) => body.append('images[]', file));
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
            key.current = crypto.randomUUID();
            setSent(true);
            router.reload({ only: ['reports', 'days'] });
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
            <div className="grid grid-cols-2 gap-4">
                <button
                    disabled={sending || openingMic}
                    aria-label={recording ? 'إيقاف التسجيل' : 'تسجيل صوت'}
                    onClick={() => {
                        void record();
                    }}
                    className={`workforce-action workforce-record ${recording ? 'is-recording' : ''}`}
                >
                    {openingMic ? (
                        <LoaderCircle size={56} className="animate-spin" />
                    ) : recording ? (
                        <Square size={56} />
                    ) : (
                        <Mic size={64} strokeWidth={1.6} />
                    )}
                    {recording && (
                        <span className="text-sm tabular-nums" dir="ltr">
                            {seconds} / 180
                        </span>
                    )}
                </button>
                <button
                    disabled={sending || recording || openingMic}
                    aria-label="التقاط صورة"
                    onClick={() => camera.current?.click()}
                    className="workforce-action workforce-camera"
                >
                    <Camera size={56} />
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
            <div className="flex justify-center gap-4">
                <button
                    disabled={sending || recording || openingMic}
                    aria-label="اختيار صور من المعرض"
                    className="workforce-icon"
                    onClick={() => gallery.current?.click()}
                >
                    <ImagePlus />
                </button>
                <button
                    disabled={sending || recording || openingMic}
                    aria-label="رفع تسجيل صوتي"
                    className="workforce-icon"
                    onClick={() => audioInput.current?.click()}
                >
                    <AudioLines />
                </button>
            </div>
            {audioUrl && (
                <div
                    aria-label="اختيار صور من المعرض"
                    className="workforce-icon"
                >
                    <VoicePlayback src={audioUrl} />
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
                <div
                    role="alert"
                    className="space-y-3 rounded-xl bg-red-100 p-4 text-red-900"
                >
                    <p>{error}</p>
                </div>
            )}
            {sent && (
                <div
                    role="status"
                    aria-label="تم إرسال التقرير"
                    className="flex items-center justify-center rounded-2xl bg-emerald-50 p-3 text-emerald-700"
                >
                    <CheckCircle2 size={40} />
                </div>
            )}
            <button
                disabled={
                    sending || openingMic || recording || !online || !audio
                }
                onClick={() => {
                    void send();
                }}
                aria-label="إرسال التقرير"
                className="workforce-send"
            >
                {sending ? (
                    <LoaderCircle size={42} className="animate-spin" />
                ) : (
                    <Send size={42} strokeWidth={1.6} />
                )}
            </button>
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
