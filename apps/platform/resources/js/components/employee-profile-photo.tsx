import { router } from '@inertiajs/react';
import { Camera, CircleUserRound, ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { speak } from '@/components/employee-guidance';

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
    const [error, setError] = useState('');
    const upload = (file?: File) => {
        if (!file || busy) return;
        if (file.size > 4 * 1024 * 1024) {
            setError('الصورة أكبر من 4MB.');
            speak('الصورة كبيرة. اختر صورة أصغر.');
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
                onSuccess: () => speak('تم حفظ صورتك.'),
                onError: (errors) => {
                    setError(
                        Object.values(errors)[0] ||
                            'تعذّر حفظ الصورة. أعد المحاولة.',
                    );
                    speak('تعذر حفظ الصورة. اطلب مساعدة المدير.');
                },
                onFinish: () => setBusy(false),
            },
        );
    };
    return (
        <section
            aria-label="صورتي الشخصية"
            className="flex flex-col items-center gap-3"
        >
            {url ? (
                <img
                    src={url}
                    alt={`صورة ${name}`}
                    className="h-28 w-28 rounded-full border-4 border-teal-600 object-cover"
                />
            ) : (
                <CircleUserRound size={96} className="text-teal-700" />
            )}
            <div className="flex gap-3">
                <button
                    disabled={busy}
                    aria-label="التقاط صورتي الشخصية"
                    className="flex items-center gap-2 rounded-xl border bg-white p-4"
                    onClick={() => camera.current?.click()}
                >
                    <Camera size={28} />
                    {busy ? '…' : 'صورتي'}
                </button>
                <button
                    disabled={busy}
                    aria-label="اختيار صورتي من المعرض"
                    className="rounded-xl border bg-white p-4"
                    onClick={() => gallery.current?.click()}
                >
                    <ImagePlus size={28} />
                </button>
            </div>
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
                    className="max-w-sm rounded-xl bg-red-100 p-3 text-red-900"
                >
                    {error}
                </p>
            )}
        </section>
    );
}
