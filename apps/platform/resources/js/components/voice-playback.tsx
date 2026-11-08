import { LoaderCircle, Pause, Play } from 'lucide-react';
import { useRef, useState } from 'react';

const clock = (seconds: number) =>
    Number.isFinite(seconds)
        ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
        : '—';
export default function VoicePlayback({ src }: { src: string }) {
    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [error, setError] = useState('');
    return (
        <div className="min-w-0 flex-1">
            <div
                className="flex items-center gap-3 rounded-2xl bg-orange-50/80 px-3 py-2"
                dir="ltr"
            >
                <button
                    type="button"
                    aria-label={
                        playing ? 'إيقاف تشغيل التسجيل' : 'تشغيل التسجيل'
                    }
                    className="voice-play"
                    disabled={loading}
                    onClick={() => {
                        const current = audio.current;
                        if (!current) return;
                        if (playing) current.pause();
                        else {
                            setError('');
                            setLoading(true);
                            void current
                                .play()
                                .catch(() =>
                                    setError(
                                        'تعذّر تشغيل الصوت. أعد المحاولة أو اطلب مساعدة المدير.',
                                    ),
                                )
                                .finally(() => setLoading(false));
                        }
                    }}
                >
                    {loading ? (
                        <LoaderCircle className="animate-spin" size={19} />
                    ) : playing ? (
                        <Pause size={19} />
                    ) : (
                        <Play size={19} />
                    )}
                </button>
                <input
                    type="range"
                    aria-label="موضع تشغيل التسجيل"
                    className="min-w-0 flex-1 accent-orange-500"
                    min={0}
                    max={
                        Number.isFinite(duration) && duration > 0 ? duration : 1
                    }
                    step={0.1}
                    value={position}
                    disabled={!duration || !Number.isFinite(duration)}
                    onChange={(event) => {
                        if (audio.current)
                            audio.current.currentTime = Number(
                                event.target.value,
                            );
                    }}
                />
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {clock(playing ? position : duration)}
                </span>
                <audio
                    ref={audio}
                    src={src}
                    preload="none"
                    onLoadedMetadata={(event) =>
                        setDuration(event.currentTarget.duration)
                    }
                    onDurationChange={(event) =>
                        setDuration(event.currentTarget.duration)
                    }
                    onTimeUpdate={(event) =>
                        setPosition(event.currentTarget.currentTime)
                    }
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onError={() => {
                        setPlaying(false);
                        setLoading(false);
                        setError(
                            'تعذّر تحميل التسجيل. تحقق من الاتصال والصلاحية.',
                        );
                    }}
                />
            </div>
            {error && (
                <p role="alert" className="mt-2 text-sm text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}
