// Copy a bounded selection while the native file-provider grant is still available.
export async function stableRecordedAudio(file: File): Promise<File> {
    if (!file.size || file.size > 12 * 1024 * 1024)
        throw new Error('audio_size');
    const bytes = await file.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength !== file.size)
        throw new Error('audio_read');
    const header = new TextDecoder('ascii').decode(bytes.slice(0, 16));
    let type = file.type;
    if (header.startsWith('RIFF') && header.slice(8, 12) === 'WAVE')
        type = 'audio/wav';
    else if (header.startsWith('#!AMR-WB')) type = 'audio/amr-wb';
    else if (header.startsWith('#!AMR')) type = 'audio/amr';
    else if (header.startsWith('OggS')) type = 'audio/ogg';
    else if (header.slice(4, 8) === 'ftyp')
        type = header.slice(8, 12).startsWith('3g')
            ? 'audio/3gpp'
            : 'audio/mp4';
    else if (new Uint8Array(bytes.slice(0, 4)).join(',') === '26,69,223,163')
        type = 'audio/webm';
    return new File([bytes], file.name || 'voice', {
        type,
        lastModified: file.lastModified,
    });
}

export function playbackFailure(
    code: number | undefined,
    local: boolean,
    name?: string,
): { code: string; message: string; previewOnly: boolean } {
    if (name === 'NotAllowedError')
        return {
            code: 'VOICE-PLAY-BLOCKED',
            message:
                'الهاتف منع تشغيل الصوت. اضغط تشغيل مرة أخرى أو اطلب مساعدة المدير.',
            previewOnly: false,
        };
    if (local && (code === 3 || code === 4))
        return {
            code: 'VOICE-PREVIEW-FORMAT',
            message:
                'تعذّرت معاينة التسجيل في هذا المتصفح. يمكنك إرساله لفحصه وتهيئته على الخادم، أو تسجيل صوت آخر.',
            previewOnly: true,
        };
    if (local)
        return {
            code: 'VOICE-PREVIEW-READ',
            message:
                'تعذّرت قراءة التسجيل المؤقت. أعد التسجيل أو اختر ملفًا صوتيًا آخر.',
            previewOnly: false,
        };
    if (code === 3 || code === 4)
        return {
            code: 'VOICE-PLAYBACK',
            message: 'تعذّر تشغيل الصوت. أعد المحاولة أو اطلب مساعدة المدير.',
            previewOnly: false,
        };
    return {
        code: 'VOICE-NETWORK',
        message: 'تعذّر تحميل التسجيل. تحقق من الاتصال والصلاحية.',
        previewOnly: false,
    };
}
