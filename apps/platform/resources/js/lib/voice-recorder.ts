export type VoiceFailure = { code: string; message: string };

export function voiceFailure(
    error: unknown,
    phase: 'access' | 'recording',
): VoiceFailure {
    const name =
        error && typeof error === 'object' && 'name' in error
            ? String(error.name)
            : '';
    if (phase === 'recording') {
        return {
            code: 'MIC-RECORDER',
            message:
                'تعذر التسجيل بعد فتح الميكروفون. أغلق التطبيقات التي تستخدم الصوت ثم أعد المحاولة في Chrome، أو استخدم رفع صوت.',
        };
    }
    if (
        ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(
            name,
        )
    ) {
        return {
            code: 'MIC-ACCESS',
            message:
                'المتصفح أو الهاتف منع الوصول إلى الميكروفون. اسمح به للموقع ولتطبيق Chrome من إعدادات الهاتف، وتأكد أن مفتاح الوصول إلى الميكروفون في الهاتف مفعّل.',
        };
    }
    if (['NotFoundError', 'DevicesNotFoundError'].includes(name)) {
        return {
            code: 'MIC-NOT-FOUND',
            message:
                'لم يجد المتصفح ميكروفونًا متاحًا. افصل سماعة بلوتوث إن وُجدت، وتحقق أن التسجيل يعمل في مسجل الصوت بالهاتف، ثم أعد المحاولة.',
        };
    }
    if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) {
        return {
            code: 'MIC-DEVICE',
            message:
                'تعذر تشغيل جهاز الميكروفون رغم طلب الإذن. قد يكون مشغولًا أو محجوبًا من الهاتف. أغلق المكالمات ومسجل الصوت، وتحقق من مفتاح الميكروفون في الهاتف، ثم أعد المحاولة.',
        };
    }
    return {
        code: 'MIC-UNKNOWN',
        message:
            'تعذر فتح الميكروفون لسبب غير محدد. أعد فتح Chrome وجرب مسجل الصوت في الهاتف. يمكنك إرسال تسجيل من زر رفع صوت.',
    };
}

export function voiceAvailability(
    secure: boolean,
    hasMicrophone: boolean,
    hasRecorder: boolean,
): VoiceFailure | null {
    if (!secure)
        return {
            code: 'MIC-HTTPS',
            message:
                'هذا الرابط لا يسمح بالتسجيل الآمن. افتح رابط التطبيق الذي يبدأ بـ HTTPS من المدير ثم أعد المحاولة.',
        };
    if (!hasMicrophone || !hasRecorder)
        return {
            code: 'MIC-UNSUPPORTED',
            message:
                'التسجيل المباشر غير متاح في هذا المتصفح. افتح التطبيق في Chrome محدث أو استخدم زر رفع صوت.',
        };
    return null;
}

// Configure handlers before start; fall back only for unsupported formats.
export function startVoiceRecorder(
    stream: MediaStream,
    configure: (recorder: MediaRecorder) => void,
    Recorder: typeof MediaRecorder = MediaRecorder,
): MediaRecorder {
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(
        (type) =>
            typeof Recorder.isTypeSupported === 'function' &&
            Recorder.isTypeSupported(type),
    );
    const attempt = (type?: string) => {
        const current = type
            ? new Recorder(stream, { mimeType: type })
            : new Recorder(stream);
        configure(current);
        try {
            current.start(1000);
            return current;
        } catch (error) {
            current.ondataavailable = null;
            current.onstop = null;
            current.onerror = null;
            throw error;
        }
    };
    if (!mime) return attempt();
    try {
        return attempt(mime);
    } catch (error) {
        if (
            !error ||
            typeof error !== 'object' ||
            !('name' in error) ||
            error.name !== 'NotSupportedError'
        )
            throw error;
        return attempt();
    }
}
