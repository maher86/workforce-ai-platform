import { usePage } from '@inertiajs/react';
import {
    Camera,
    ImagePlus,
    Mic,
    Send,
    Square,
    Trash2,
    AudioLines,
    LoaderCircle,
    WifiOff,
    Settings2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import VoicePlayback from '@/components/voice-playback';
import MicrophoneAccessHelp from '@/components/microphone-access-help';
import {
    reportUpload,
    useReportUpload,
    useReportProgress,
} from '@/hooks/use-report-upload';
import { uploadPending } from '@/lib/report-upload';
import { processingReport } from '@/lib/report-progress';
import { stableRecordedAudio } from '@/lib/audio-preview';
import {
    inAndroidApp,
    nativeVoice,
    nativeVoiceFailure,
} from '@/lib/android-device';
import { startNativeVoice } from '@/lib/native-voice-session';
import {
    startVoiceRecorder,
    voiceAvailability,
    voiceFailure,
    openMicrophone,
} from '@/lib/voice-recorder';

export type WorkItem = {
    id: number;
    name: string;
    kind: 'project' | 'task';
    project_id: number | null;
    active?: boolean;
};

type EditableReport = {
    id: number;
    source_version: number;
    media: { id: number; kind: string }[];
};
export default function ReportComposer({
    edit,
    onSaved,
}: { edit?: EditableReport; onSaved?: () => void } = {}) {
    const { employeeUploadScope } = usePage<{
        employeeUploadScope: string | null;
    }>().props;
    const upload = useReportUpload();
    const progress = useReportProgress();
    const started = useRef(false);
    const [retained, setRetained] = useState(edit?.media ?? []);
    const [audio, setAudio] = useState<File | null>(null);
    const [images, setImages] = useState<File[]>([]);
    const [recording, setRecording] = useState(false);
    const [openingMic, setOpeningMic] = useState(false);
    const [readingAudio, setReadingAudio] = useState(false);
    const selectionVersion = useRef(0);
    const [seconds, setSeconds] = useState(0);
    const editingBusy = Boolean(edit) && uploadPending(upload);
    const sending =
        readingAudio ||
        uploadPending(upload) ||
        upload.status === 'error' ||
        progress.reports.filter(processingReport).length >= 20;
    const [error, setError] = useState('');
    const [recordingHelp, setRecordingHelp] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [previews, setPreviews] = useState<string[]>([]);
    const [audioUrl, setAudioUrl] = useState('');
    const key = useRef(crypto.randomUUID());
    const recorder = useRef<MediaRecorder | null>(null);
    const nativeRecorder = useRef<Awaited<
        ReturnType<typeof startNativeVoice>
    > | null>(null);
    const starting = useRef(false);
    const mounted = useRef(true);
    const stream = useRef<MediaStream | null>(null);
    const began = useRef(0);
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);
    const audioInput = useRef<HTMLInputElement>(null);
    const nativeAudioInput = useRef<HTMLInputElement>(null);
    const microphoneRequest = useRef<AbortController | null>(null);

    useEffect(() => {
        if (
            edit &&
            started.current &&
            upload.status === 'success' &&
            upload.reportId === edit.id
        ) {
            started.current = false;
            onSaved?.();
        }
    }, [edit, onSaved, upload.status, upload.reportId]);

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
            if (elapsed >= 180) {
                if (recorder.current?.state === 'recording')
                    recorder.current.stop();
                nativeRecorder.current?.stop();
            }
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
            selectionVersion.current++;
            microphoneRequest.current?.abort();
            nativeRecorder.current?.cancel();
            if (recorder.current?.state === 'recording')
                recorder.current.stop();
            stream.current?.getTracks().forEach((track) => track.stop());
        };
    }, [employeeUploadScope]);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => {
            if (audio || images.length || recording) event.preventDefault();
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [audio, images.length, recording]);

    const captureOnPhone = () => {
        microphoneRequest.current?.abort();
        setOpeningMic(false);
        setError('');
        nativeAudioInput.current?.click();
    };

    const receiveAudio = async (file: File | undefined) => {
        if (!file) return;
        const version = ++selectionVersion.current;
        setReadingAudio(true);
        if (!file.size || file.size > 12 * 1024 * 1024) {
            setAudio(null);
            setReadingAudio(false);
            setError('التسجيل فارغ أو أكبر من 12MB. استخدم تسجيلًا أقصر.');
            return;
        }
        try {
            const stable = await stableRecordedAudio(file);
            if (!mounted.current || version !== selectionVersion.current)
                return;
            setAudio(stable);
            setSeconds(0);
            setError('');
            setRecordingHelp(false);
        } catch {
            if (mounted.current && version === selectionVersion.current) {
                setAudio(null);
                setError(
                    'تعذّرت قراءة التسجيل من الهاتف. أعد التسجيل أو اختر تسجيلًا آخر. [VOICE-FILE]',
                );
            }
        } finally {
            if (mounted.current && version === selectionVersion.current)
                setReadingAudio(false);
        }
    };

    const record = async () => {
        if (recording) {
            if (nativeRecorder.current) {
                nativeRecorder.current.stop();
                setRecording(false);
                setReadingAudio(true);
                return;
            }
            if (recorder.current?.state === 'recording')
                recorder.current.stop();
            return;
        }
        if (starting.current) return;
        setError('');
        if (inAndroidApp()) {
            starting.current = true;
            setOpeningMic(true);
            const access = new AbortController();
            microphoneRequest.current = access;
            try {
                const session = await startNativeVoice(
                    nativeVoice,
                    crypto.randomUUID(),
                    access.signal,
                    (file) => {
                        if (!mounted.current) return;
                        setRecording(false);
                        void receiveAudio(file);
                    },
                    (failure) => {
                        if (!mounted.current) return;
                        setRecording(false);
                        setReadingAudio(false);
                        setError(nativeVoiceFailure(failure));
                    },
                );
                nativeRecorder.current = session;
                if (session.state === 'recording' && mounted.current) {
                    began.current = Date.now();
                    setSeconds(0);
                    setRecording(true);
                }
            } catch (failure) {
                if (mounted.current && !access.signal.aborted)
                    setError(nativeVoiceFailure(failure));
            } finally {
                starting.current = false;
                if (mounted.current) setOpeningMic(false);
            }
            return;
        }
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
        const access = new AbortController();
        microphoneRequest.current = access;
        let phase: 'access' | 'recording' = 'access';
        try {
            const microphone = await openMicrophone(
                () => navigator.mediaDevices.getUserMedia({ audio: true }),
                access.signal,
            );
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
                        void receiveAudio(
                            new File(
                                [blob],
                                mime.includes('mp4')
                                    ? 'voice.m4a'
                                    : 'voice.webm',
                                { type: mime },
                            ),
                        );
                    else if (mounted.current) {
                        setAudio(null);
                        setError(
                            'لم يُحفظ صوت في هذا التسجيل. أعد التسجيل. [MIC-EMPTY]',
                        );
                    }
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
            if (access.signal.aborted) return;
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
        setError('');
        const next = [...images, ...Array.from(files)];
        if (
            next.length +
                retained.filter((item) => item.kind === 'image').length >
                3 ||
            next.some((file) => file.size > 12 * 1024 * 1024)
        ) {
            setError('الحد ثلاث صور، وحتى 12MB لكل ملف.');
            return;
        }
        setImages(next);
    };

    const send = () => {
        if (sending || recording || openingMic || !online) return;
        if (
            (images.length || retained.some((item) => item.kind === 'image')) &&
            !audio &&
            !retained.some((item) => item.kind === 'audio')
        ) {
            setError('أضف تسجيلًا صوتيًا مع الصور. الصورة وحدها لا تُرسل.');
            return;
        }
        setError('');
        const body = new FormData();
        if (edit) {
            body.set('change_key', key.current);
            body.set('source_version', String(edit.source_version));
            retained.forEach((item) => body.append('keep[]', String(item.id)));
        } else body.set('submission_key', key.current);
        if (audio) body.set('audio', audio);
        images.forEach((file) => body.append('images[]', file));
        if (
            !employeeUploadScope ||
            !reportUpload.start(
                employeeUploadScope,
                edit
                    ? `/employee/reports/${edit.id}/amend`
                    : '/employee/reports',
                body,
            )
        ) {
            setError('تحقق من عملية الإرسال الحالية أو اطلب مساعدة المدير.');
            return;
        }
        started.current = true;
        // The uploader owns the files now. Stay home and allow preparing the next recording.
        setAudio(null);
        setImages([]);
        setSeconds(0);
        key.current = crypto.randomUUID();
    };

    return (
        <section className="w-full space-y-5" aria-label="إرسال تقرير">
            <div className="grid grid-cols-2 gap-4">
                <button
                    disabled={openingMic || editingBusy || readingAudio}
                    aria-label={recording ? 'إيقاف التسجيل' : 'تسجيل صوت'}
                    onClick={() => {
                        void record();
                    }}
                    className={`workforce-action workforce-record relative ${recording ? 'is-recording' : ''}`}
                >
                    {openingMic || readingAudio ? (
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
                    disabled={recording || openingMic || editingBusy}
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
                // Android WebView requires image/* with capture to select the camera path.
                accept="image/*"
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
                ref={nativeAudioInput}
                type="file"
                accept="audio/*"
                capture="user"
                className="hidden"
                onChange={(event) => {
                    const input = event.currentTarget;
                    void receiveAudio(input.files?.[0]).finally(() => {
                        input.value = '';
                    });
                }}
            />
            <input
                ref={audioInput}
                type="file"
                accept="audio/*,.webm,.m4a,.mp4"
                className="hidden"
                onChange={(event) => {
                    const input = event.currentTarget;
                    void receiveAudio(input.files?.[0]).finally(() => {
                        input.value = '';
                    });
                }}
            />
            <div className="flex justify-center gap-4">
                <button
                    disabled={recording || openingMic || editingBusy}
                    aria-label="اختيار صور من المعرض"
                    className="workforce-icon"
                    onClick={() => gallery.current?.click()}
                >
                    <ImagePlus />
                </button>
                <button
                    disabled={recording || openingMic || editingBusy}
                    aria-label="رفع تسجيل صوتي"
                    className="workforce-icon"
                    onClick={() => audioInput.current?.click()}
                >
                    <AudioLines />
                </button>
                <button
                    type="button"
                    disabled={recording || editingBusy}
                    aria-label="خيارات التسجيل ومساعدة المدير"
                    aria-expanded={recordingHelp}
                    className="workforce-icon"
                    onClick={() => setRecordingHelp(!recordingHelp)}
                >
                    <Settings2 />
                </button>
                {openingMic && (
                    <button
                        type="button"
                        aria-label="إلغاء انتظار الميكروفون"
                        className="workforce-icon text-red-600"
                        onClick={() => microphoneRequest.current?.abort()}
                    >
                        <X />
                    </button>
                )}
            </div>
            {!audioUrl &&
                edit &&
                retained
                    .filter((item) => item.kind === 'audio')
                    .map((item) => (
                        <div
                            key={item.id}
                            className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-white p-3"
                        >
                            <VoicePlayback
                                src={`/employee/reports/${edit.id}/media/${item.id}`}
                            />
                            <button
                                type="button"
                                aria-label="استبدال التسجيل الحالي"
                                className="shrink-0 rounded-full p-3 text-red-600"
                                disabled={
                                    recording || openingMic || editingBusy
                                }
                                onClick={() =>
                                    setRetained(
                                        retained.filter(
                                            (entry) => entry.id !== item.id,
                                        ),
                                    )
                                }
                            >
                                <Trash2 />
                            </button>
                        </div>
                    ))}
            {edit && (
                <div className="grid grid-cols-3 gap-2">
                    {retained
                        .filter((item) => item.kind === 'image')
                        .map((item) => (
                            <div key={item.id} className="relative">
                                <img
                                    src={`/employee/reports/${edit.id}/media/${item.id}`}
                                    alt="صورة مرفقة"
                                    className="aspect-square w-full rounded-2xl object-cover"
                                />
                                <button
                                    type="button"
                                    aria-label="إزالة الصورة من التقرير"
                                    className="absolute top-1 right-1 rounded-full bg-white p-2 text-red-600"
                                    onClick={() =>
                                        setRetained(
                                            retained.filter(
                                                (entry) => entry.id !== item.id,
                                            ),
                                        )
                                    }
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                </div>
            )}
            {audioUrl && (
                <div
                    aria-label="معاينة التسجيل قبل الإرسال"
                    className="flex w-full min-w-0 items-center gap-2 rounded-2xl border border-white bg-white/80 p-3"
                >
                    <VoicePlayback src={audioUrl} />
                    <button
                        aria-label="حذف التسجيل قبل الإرسال"
                        disabled={recording || openingMic || editingBusy}
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
            {(recordingHelp || /\[MIC-[A-Z-]+\]$/.test(error)) && (
                <MicrophoneAccessHelp
                    busy={recording || editingBusy}
                    browserBusy={openingMic}
                    onRetry={() => {
                        void record();
                    }}
                    onCapture={captureOnPhone}
                    onUpload={() => audioInput.current?.click()}
                />
            )}
            <button
                disabled={
                    sending ||
                    openingMic ||
                    recording ||
                    !online ||
                    (!audio && !retained.some((item) => item.kind === 'audio'))
                }
                onClick={() => {
                    send();
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
            {images.length > 0 &&
                !audio &&
                !retained.some((item) => item.kind === 'audio') && (
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
