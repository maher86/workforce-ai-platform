import { useUiLocale } from '@/hooks/use-ui-locale';
import { AudioLines, LoaderCircle, Pause, Play, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { playbackFailure } from '@/lib/audio-preview';

const clock = (seconds: number) =>
    Number.isFinite(seconds)
        ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
        : '—';
export default function VoicePlayback({ src }: { src: string }) {
    // New sources must not inherit old errors/position or a revoked blob URL.
    return <VoicePlayer key={src} src={src} />;
}

function VoicePlayer({ src }: { src: string }) {
    const { t } = useUiLocale();

    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [error, setError] = useState('');
    const [previewOnly, setPreviewOnly] = useState(false);
    const [help, setHelp] = useState(false);
    const mounted = useRef(true);
    const unsupported = useRef(false);
    useEffect(() => {
        mounted.current = true;
        const player = audio.current;
        return () => {
            mounted.current = false;
            player?.pause();
        };
    }, []);
    const fail = (code?: number, name?: string) => {
        if (!mounted.current || unsupported.current) return;
        const failure = playbackFailure(code, src.startsWith('blob:'), name);
        unsupported.current = failure.previewOnly;
        setPlaying(false);
        setLoading(false);
        setPreviewOnly(failure.previewOnly);
        setError(`${t(failure.message)} [${failure.code}]`);
    };
    if (previewOnly)
        return (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-2xl bg-orange-50 p-3 text-orange-700">
                <AudioLines
                    size={28}
                    aria-label="تم إرفاق تسجيل؛ المعاينة المحلية غير متاحة"
                />
                <button
                    type="button"
                    className="rounded-full p-2"
                    aria-label="تفاصيل المعاينة للمدير"
                    aria-expanded={help}
                    onClick={() => setHelp(!help)}
                >
                    <Settings2 size={20} />
                </button>
                {help && <p className="w-full text-sm">{error}</p>}
            </div>
        );
    return (
        <div className="w-full min-w-0 flex-1">
            <div
                className="flex min-w-0 items-center gap-2 rounded-2xl bg-orange-50/80 px-3 py-2"
                dir="ltr"
            >
                <button
                    type="button"
                    aria-label={
                        playing ? t('إيقاف تشغيل التسجيل') : t('تشغيل التسجيل')
                    }
                    className="voice-play"
                    disabled={loading}
                    onClick={() => {
                        const current = audio.current;
                        if (!current) return;
                        if (playing) current.pause();
                        else {
                            if (current.error) current.load();
                            setError('');
                            setLoading(true);
                            void current
                                .play()
                                .catch((reason: unknown) =>
                                    fail(
                                        current.error?.code,
                                        reason &&
                                            typeof reason === 'object' &&
                                            'name' in reason
                                            ? String(reason.name)
                                            : '',
                                    ),
                                )
                                .finally(() => {
                                    if (mounted.current) setLoading(false);
                                });
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
                    aria-label={t('موضع تشغيل التسجيل')}
                    className="w-0 min-w-0 flex-1 accent-orange-500"
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
                <span className="shrink-0 text-xs font-semibold text-slate-600 tabular-nums">
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
                    onError={(event) => fail(event.currentTarget.error?.code)}
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
