import {
    AudioLines,
    Check,
    CircleUserRound,
    FileText,
    ImagePlus,
    Languages,
    LayoutDashboard,
    Mic,
    Pause,
    Play,
    Send,
    Smartphone,
    Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUiLocale } from '@/hooks/use-ui-locale';

const source = 'فحصت المضخة؛ التشغيل لم يبدأ بعد.';
const english = 'I inspected the pump. Operation has not started yet.';
const content = {
    ar: {
        label: 'كيف تعمل Workforce: تسجيل، إرسال، ترجمة، ثم متابعة المدير',
        demo: 'معاينة توضيحية',
        employee: 'الموظف',
        manager: 'المدير',
        steps: ['يسجّل', 'يرسل', 'يُترجم', 'يظهر للمدير'],
        titles: [
            'تسجيل الموظف',
            'إرسال التقرير',
            'النص الأصلي + English',
            'لوحة المدير',
        ],
        states: ['بلغته', 'صورة اختيارية', 'ترجمة أمينة', 'جاهز للمتابعة'],
        captions: [
            'يسجّل الموظف بلغته.',
            'يرسل الصوت مع صورة اختيارية.',
            'نص أصلي محفوظ، وترجمة إنجليزية أمينة.',
            'يظهر التقرير للمدير مباشرة، دون موافقة مسبقة.',
        ],
        photo: 'صورة اختيارية',
        sending: 'تسجيل واحد، بكل التفاصيل.',
        supporting: 'الصورة تدعم التقرير عند الحاجة.',
        original: 'النص الأصلي · العربية',
        arrived: 'وصل التقرير إلى المدير.',
        report: 'تقرير موظف',
        reportDetail: 'النص الأصلي + English',
        direct: 'جاهز للمتابعة، دون موافقة مسبقة.',
        pause: 'إيقاف مؤقت',
        resume: 'متابعة العرض',
        chapters: 'مراحل توضيحية',
        note: 'صوت + صورة اختيارية ← نص أصلي + English',
    },
    en: {
        label: 'How Workforce works: record, send, translate and follow up',
        demo: 'Illustrative preview',
        employee: 'Employee',
        manager: 'Manager',
        steps: ['Record', 'Send', 'Translate', 'Manager'],
        titles: [
            'Employee recording',
            'Send report',
            'Original + English',
            'Manager dashboard',
        ],
        states: [
            'Their language',
            'Optional photo',
            'Faithful translation',
            'Ready to follow up',
        ],
        captions: [
            'Employees record in their own language.',
            'Send the voice note with an optional photo.',
            'Keep the original text and a faithful English translation.',
            'The report appears for the manager without an approval step.',
        ],
        photo: 'Optional photo',
        sending: 'One voice note. All the details.',
        supporting: 'Add a photo when it helps explain the work.',
        original: 'Original · Arabic',
        arrived: 'Report delivered to the manager.',
        report: 'Employee report',
        reportDetail: 'Original text + English',
        direct: 'Ready to follow up. No approval required.',
        pause: 'Pause',
        resume: 'Continue',
        chapters: 'Illustrative stages',
        note: 'Voice + optional photo → original + English',
    },
};
const stepIcons = [Mic, Send, Languages, LayoutDashboard];
const duration = 14000;

export default function WorkflowStory() {
    const { locale, direction } = useUiLocale();
    const copy = locale === 'en' ? content.en : content.ar;
    const [phase, setPhase] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [reduced, setReduced] = useState(
        () =>
            typeof window === 'undefined' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
    const root = useRef<HTMLElement>(null);
    const elapsed = useRef(0);
    const manuallyPaused = useRef(false);
    const inView = useRef(false);
    const StepIcon = stepIcons[phase];

    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const change = () => {
            setReduced(media.matches);
            if (media.matches) setPlaying(false);
        };
        media.addEventListener('change', change);
        return () => media.removeEventListener('change', change);
    }, []);

    useEffect(() => {
        if (reduced || !root.current) return;
        const syncPlayback = () => {
            setPlaying(
                inView.current && !document.hidden && !manuallyPaused.current,
            );
        };
        const observer =
            typeof IntersectionObserver === 'undefined'
                ? null
                : new IntersectionObserver(
                      (entries) => {
                          inView.current = entries.some(
                              (entry) =>
                                  entry.isIntersecting &&
                                  entry.intersectionRatio >= 0.2,
                          );
                          syncPlayback();
                      },
                      { threshold: 0.2 },
                  );
        if (observer) observer.observe(root.current);
        else {
            inView.current = true;
            syncPlayback();
        }
        document.addEventListener('visibilitychange', syncPlayback);
        return () => {
            observer?.disconnect();
            document.removeEventListener('visibilitychange', syncPlayback);
        };
    }, [reduced]);

    useEffect(() => {
        if (!playing || reduced) return;
        let frame = 0;
        let last = performance.now();
        let previous = Math.min(
            3,
            Math.floor(elapsed.current / (duration / 4)),
        );
        const tick = (now: number) => {
            if (document.hidden) {
                setPlaying(false);
                return;
            }
            elapsed.current =
                (elapsed.current + Math.min(now - last, 80)) % duration;
            last = now;
            const next = Math.min(
                3,
                Math.floor(elapsed.current / (duration / 4)),
            );
            if (next !== previous) {
                previous = next;
                setPhase(next);
            }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => {
            cancelAnimationFrame(frame);
        };
    }, [playing, reduced]);

    const jump = (next: number) => {
        manuallyPaused.current = true;
        elapsed.current = (next * duration) / 4;
        setPlaying(false);
        setPhase(next);
    };
    const toggle = () => {
        manuallyPaused.current = playing;
        setPlaying(!playing && inView.current && !document.hidden && !reduced);
    };
    const action = playing ? copy.pause : copy.resume;
    const ActionIcon = playing ? Pause : Play;

    return (
        <section
            ref={root}
            className="workflow-story"
            dir={direction}
            lang={locale}
            data-phase={phase}
            data-playing={playing}
            aria-label={copy.label}
        >
            <header className="story-brand">
                <span>
                    <AudioLines size={20} aria-hidden="true" />
                    <b dir="ltr">Workforce</b>
                </span>
                <span className="story-demo">{copy.demo}</span>
            </header>
            <div className="story-stage">
                <div className="story-halo" aria-hidden="true" />
                <div className="story-sheet">
                    <div className="story-sheet-top">
                        <span className="story-symbol">
                            <StepIcon size={16} aria-hidden="true" />
                        </span>
                        <span>{copy.titles[phase]}</span>
                        <span className="story-state">
                            {copy.states[phase]}
                        </span>
                    </div>
                    <div
                        className="story-scene story-record"
                        aria-hidden={phase !== 0}
                        data-active={phase === 0}
                    >
                        <div className="story-mic">
                            <Mic size={30} aria-hidden="true" />
                        </div>
                        <div className="story-wave" aria-hidden="true">
                            {Array.from({ length: 17 }, (_, i) => (
                                <span
                                    key={i}
                                    style={{
                                        height: [11, 20, 28, 16, 24][i % 5],
                                        animationDelay: `${-(i % 4) * 150}ms`,
                                    }}
                                />
                            ))}
                        </div>
                        <span className="story-time" dir="ltr">
                            0:07
                        </span>
                        <span className="story-photo">
                            <ImagePlus size={14} aria-hidden="true" />
                            {copy.photo}
                        </span>
                    </div>
                    <div
                        className="story-scene story-transfer"
                        aria-hidden={phase !== 1}
                        data-active={phase === 1}
                    >
                        <div
                            className="story-transfer-icons"
                            aria-hidden="true"
                        >
                            <span>
                                <AudioLines size={24} />
                            </span>
                            <b />
                            <b />
                            <b />
                            <span>
                                <Sparkles size={24} />
                            </span>
                        </div>
                        <h3>{copy.sending}</h3>
                        <p>{copy.supporting}</p>
                    </div>
                    <div
                        className="story-scene story-text"
                        aria-hidden={phase !== 2}
                        data-active={phase === 2}
                    >
                        <div>
                            <span className="story-field-label">
                                {copy.original}
                            </span>
                            <p lang="ar" dir="rtl">
                                {source}
                            </p>
                        </div>
                        <div className="story-divider" />
                        <div>
                            <span className="story-field-label" lang="en">
                                English
                            </span>
                            <p lang="en" dir="ltr">
                                {english}
                            </p>
                        </div>
                    </div>
                    <div
                        className="story-scene story-arrival"
                        aria-hidden={phase !== 3}
                        data-active={phase === 3}
                    >
                        <span className="story-arrival-check">
                            <Check size={20} aria-hidden="true" />
                        </span>
                        <h3>{copy.arrived}</h3>
                        <div className="story-arrival-row">
                            <CircleUserRound size={28} aria-hidden="true" />
                            <span>
                                {copy.report}
                                <small>{copy.reportDetail}</small>
                            </span>
                            <FileText size={20} aria-hidden="true" />
                        </div>
                        <p>{copy.direct}</p>
                    </div>
                </div>
                <div className="story-float story-employee" aria-hidden="true">
                    <Smartphone size={15} />
                    {copy.employee}
                </div>
                <div className="story-float story-manager" aria-hidden="true">
                    <LayoutDashboard size={15} />
                    {copy.manager}
                </div>
            </div>
            <p className="story-caption" role="status">
                {copy.captions[phase]}
            </p>
            <div
                className="story-chapters"
                role="group"
                aria-label={copy.chapters}
            >
                {copy.steps.map((step, i) => {
                    const Icon = stepIcons[i];
                    return (
                        <button
                            type="button"
                            key={i}
                            onClick={() => jump(i)}
                            aria-pressed={phase === i}
                        >
                            <Icon size={16} aria-hidden="true" />
                            <span>{step}</span>
                        </button>
                    );
                })}
            </div>
            <footer className="story-controls">
                <span>{copy.note}</span>
                {!reduced && (
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={action}
                        title={action}
                        aria-pressed={playing}
                    >
                        <ActionIcon size={14} aria-hidden="true" />
                    </button>
                )}
            </footer>
        </section>
    );
}
