import { router } from '@inertiajs/react';
import {
    Camera,
    CircleUserRound,
    ImagePlus,
    LoaderCircle,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';

export default function EmployeeProfilePhoto({
    url,
    name,
}: {
    url: string | null;
    name: string;
}) {
    const camera = useRef<HTMLInputElement>(null);
    const gallery = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const upload = (file?: File) => {
        if (!file || busy) return;
        if (file.size > 4 * 1024 * 1024) {
            setError('الصورة أكبر من 4MB.');
            return;
        }
        setError('');
        setBusy(true);
        router.post(
            '/employee/profile',
            { photo: file },
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => setOpen(false),
                onError: (errors) =>
                    setError(
                        Object.values(errors)[0] ||
                            'تعذّر حفظ الصورة. أعد المحاولة.',
                    ),
                onFinish: () => setBusy(false),
            },
        );
    };
    return (
        <section
            aria-label="صورتي الشخصية"
            className="relative flex flex-col items-center"
        >
            <div className="relative">
                <div className="profile-portrait">
                    {url ? (
                        <img
                            src={url}
                            alt={`صورة ${name}`}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <CircleUserRound size={84} strokeWidth={1.2} />
                    )}
                </div>
                <button
                    type="button"
                    aria-label="إضافة أو تحديث صورتي الشخصية"
                    aria-expanded={open}
                    disabled={busy}
                    className="profile-camera"
                    onClick={() => setOpen(!open)}
                >
                    {busy ? (
                        <LoaderCircle className="animate-spin" size={21} />
                    ) : (
                        <Camera size={21} />
                    )}
                </button>
            </div>
            {open && (
                <div className="absolute top-full z-20 mt-3 flex gap-2 rounded-2xl border border-white bg-white p-2 shadow-xl">
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="التقاط صورتي بالكاميرا"
                        disabled={busy}
                        onClick={() => camera.current?.click()}
                    >
                        <Camera />
                    </button>
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="اختيار صورتي من المعرض"
                        disabled={busy}
                        onClick={() => gallery.current?.click()}
                    >
                        <ImagePlus />
                    </button>
                    <button
                        type="button"
                        className="workforce-icon"
                        aria-label="إغلاق خيارات الصورة"
                        onClick={() => setOpen(false)}
                    >
                        <X />
                    </button>
                </div>
            )}
            <input
                ref={camera}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="user"
                className="hidden"
                onChange={(event) => {
                    upload(event.target.files?.[0]);
                    event.target.value = '';
                }}
            />
            <input
                ref={gallery}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                    upload(event.target.files?.[0]);
                    event.target.value = '';
                }}
            />
            {error && (
                <p
                    role="alert"
                    className="mt-4 max-w-sm rounded-xl bg-red-100 p-3 text-sm text-red-900"
                >
                    {error}
                </p>
            )}
        </section>
    );
}
