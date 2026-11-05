import { Download, Volume2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function speak(text: string) {
    if ('speechSynthesis' in window) {
        const message = new SpeechSynthesisUtterance(text);
        message.lang = 'ar';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(message);
    }
}

interface InstallEvent extends Event {
    prompt(): Promise<void>;
}

export function EmployeeGuidance() {
    const [install, setInstall] = useState<InstallEvent | null>(null);
    const [instructions, setInstructions] = useState(false);
    useEffect(() => {
        const handler = (event: Event) => {
            event.preventDefault();
            setInstall(event as InstallEvent);
        };
        window.addEventListener('beforeinstallprompt', handler);
        const installed = () => setInstall(null);
        window.addEventListener('appinstalled', installed);
        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installed);
        };
    }, []);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap justify-center gap-4">
                <button
                    aria-label="استمع للتعليمات بالعربية"
                    className="rounded-2xl border p-6"
                    onClick={() =>
                        speak(
                            'هذا حسابك. اطلب من المدير إضافة التطبيق إلى الشاشة الرئيسية. بعدها افتح حسابك من الأيقونة.',
                        )
                    }
                >
                    <Volume2 size={40} />
                </button>
                <button
                    aria-label="إضافة التطبيق للشاشة الرئيسية"
                    className="flex items-center gap-3 rounded-2xl border p-6 text-xl"
                    onClick={() => {
                        if (install) {
                            void install.prompt().then(() => setInstall(null));
                        } else {
                            setInstructions(!instructions);
                        }
                    }}
                >
                    <Download size={40} />
                    تثبيت
                </button>
            </div>
            {instructions && (
                <p className="rounded-xl border p-4">
                    بمساعدة المدير: من قائمة المتصفح اختر «إضافة إلى الشاشة
                    الرئيسية». على iPhone استخدم زر المشاركة في Safari. إذا طلب
                    التطبيق التفعيل مجددًا، اطلب QR جديدًا. لا تُثبّت التطبيق على
                    هاتف مشترك.
                </p>
            )}
        </section>
    );
}
