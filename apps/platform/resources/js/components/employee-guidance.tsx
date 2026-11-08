import { Download, Ellipsis, Plus, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
interface InstallEvent extends Event {
    prompt(): Promise<void>;
}
export function EmployeeGuidance() {
    const [install, setInstall] = useState<InstallEvent | null>(null);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const handler = (event: Event) => {
            event.preventDefault();
            setInstall(event as InstallEvent);
        };
        const installed = () => setInstall(null);
        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installed);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);
    return (
        <div className="relative">
            <button
                type="button"
                className="workforce-icon"
                aria-label="إضافة التطبيق إلى الشاشة الرئيسية"
                onClick={() => {
                    if (install)
                        void install
                            .prompt()
                            .catch(() =>
                                setError(
                                    'تعذّر فتح التثبيت. اطلب مساعدة المدير.',
                                ),
                            );
                    else setOpen(!open);
                }}
            >
                <Download size={21} />
            </button>
            {open && (
                <div
                    className="absolute top-full left-0 z-20 mt-3 flex items-center gap-3 rounded-2xl bg-white p-4 text-slate-700 shadow-xl"
                    aria-label="التثبيت من قائمة المتصفح أو المشاركة"
                >
                    <Ellipsis />
                    <span aria-hidden="true">→</span>
                    <Share2 />
                    <Plus />
                    <button
                        type="button"
                        aria-label="إغلاق"
                        onClick={() => setOpen(false)}
                    >
                        <X />
                    </button>
                </div>
            )}
            {error && (
                <p role="alert" className="text-sm text-red-700">
                    {error}
                </p>
            )}
        </div>
    );
}
