import { Head, Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    AudioLines,
    Camera,
    Check,
    ClipboardList,
    FileText,
    Languages,
    Mic,
    ShieldCheck,
} from 'lucide-react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import { useUiLocale } from '@/hooks/use-ui-locale';

const content = {
    ar: {
        pageTitle: 'تقارير فريقك، ببساطة',
        product: 'تقارير الفريق بالصوت والصورة',
        login: 'دخول المدير',
        loginShort: 'دخول',
        eyebrow: 'عمل ميداني. تقارير أوضح.',
        heading: 'من صوت الموظف',
        accent: 'إلى تقرير واضح.',
        description:
            'يسجّل الموظف بلغته، ويضيف صورًا عند الحاجة. وتصل للمدير تقارير منظّمة بالنص الأصلي والإنجليزية، في مكان واحد.',
        create: 'أنشئ حساب شركتك',
        access: 'أنشئ الشركة، أضف الفريق، وفعّل تطبيق الموظف عبر QR.',
        demo: 'معاينة توضيحية',
        report: 'تقرير عمل',
        audio: 'تسجيل صوتي',
        source: 'النص الأصلي',
        english: 'الترجمة الإنجليزية',
        attachments: 'صور اختيارية مع التسجيل',
        private: 'مساحة خاصة بمؤسستك',
        features: [
            [
                'تحدّث بطريقتك',
                'يسجّل الموظف بلغته، دون كتابة أو مهمة محدّدة مسبقًا.',
            ],
            [
                'الأصل والإنجليزية معًا',
                'النص الأصلي محفوظ، والترجمة الإنجليزية بجانبه لسهولة المتابعة.',
            ],
            [
                'الصورة أوضح للمدير',
                'تقارير الفريق في لوحة واحدة، مع البحث حسب الموظف والتاريخ.',
            ],
        ],
        footer: 'تقارير يومية أبسط. رؤية أوضح للفريق.',
        preview: 'نسخة قيد التطوير',
        illustration:
            'مثال توضيحي لتقرير يحتوي على تسجيل ونص أصلي وترجمة إنجليزية',
    },
    en: {
        pageTitle: 'Team reporting, simplified',
        product: 'Voice-first team reporting',
        login: 'Manager sign in',
        loginShort: 'Sign in',
        eyebrow: 'Field work. Clearer reports.',
        heading: 'From a voice note',
        accent: 'to a clear report.',
        description:
            'Employees speak in their own language and add photos when needed. Managers get the original text and English translation, together in one place.',
        create: 'Create your company account',
        access: 'Create your company, add your team, activate employees through the Android app.',
        demo: 'Illustrative preview',
        report: 'Work report',
        audio: 'Voice recording',
        source: 'Original text',
        english: 'English translation',
        attachments: 'Optional photos with audio',
        private: 'Your own company workspace',
        features: [
            [
                'Let your team speak',
                'Report in any supported language, without typing or a predefined task.',
            ],
            [
                'Original and English, together',
                'Keep the original text, with its English translation alongside it.',
            ],
            [
                'A clearer view for managers',
                'Find team reports in one dashboard, filtered by employee and date.',
            ],
        ],
        footer: 'Simpler daily reports. A clearer view of your team.',
        preview: 'In development',
        illustration:
            'Illustrative report with voice recording, original text and English translation',
    },
};
const waveform = [
    12, 22, 16, 30, 42, 25, 17, 34, 48, 27, 38, 19, 31, 45, 23, 15, 35, 27, 42,
    21, 33, 16, 25, 12,
];
const featureIcons = [Mic, Languages, ClipboardList];

export default function Welcome() {
    const { locale, direction } = useUiLocale();
    const copy = locale === 'en' ? content.en : content.ar;
    return (
        <main
            dir={direction}
            lang={locale}
            className="welcome-page min-h-svh text-slate-900"
        >
            <Head title={copy.pageTitle} />
            <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 py-6">
                    <Link
                        href="/"
                        aria-label="Workforce"
                        className="flex items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500"
                    >
                        <span className="grid size-10 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/15 sm:size-11">
                            <AudioLines size={25} strokeWidth={2} />
                        </span>
                        <span className="hidden min-[360px]:block">
                            <span
                                dir="ltr"
                                className="block text-lg font-extrabold tracking-tight sm:text-xl"
                            >
                                Workforce
                                <span className="text-orange-500">.</span>
                            </span>
                            <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                                {copy.product}
                            </span>
                        </span>
                    </Link>
                    <nav
                        aria-label={
                            locale === 'ar'
                                ? 'اللغة وحساب المدير'
                                : 'Language and manager account'
                        }
                        className="flex items-center gap-2 sm:gap-5"
                    >
                        <ManagerLanguageSwitch className="min-h-11 border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:border-orange-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500" />
                        <Link
                            href="/login"
                            aria-label={copy.login}
                            className="welcome-link min-h-11 content-center rounded-xl px-1 text-sm font-semibold text-slate-700 sm:px-3"
                        >
                            <span className="sm:hidden">{copy.loginShort}</span>
                            <span className="hidden sm:inline">
                                {copy.login}
                            </span>
                        </Link>
                    </nav>
                </header>

                <section
                    className="grid grid-cols-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[1.04fr_1fr] lg:gap-16 lg:py-20"
                    aria-labelledby="welcome-heading"
                >
                    <div className="max-w-xl min-w-0">
                        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-200/70 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-800">
                            <span
                                className="size-1.5 rounded-full bg-orange-500"
                                aria-hidden="true"
                            />
                            {copy.eyebrow}
                        </span>
                        <h1
                            id="welcome-heading"
                            className="text-[2.1rem] leading-[1.35] font-extrabold tracking-tight text-slate-900 min-[390px]:text-[2.4rem] sm:text-5xl lg:text-[3.35rem]"
                        >
                            {copy.heading}
                            <span className="mt-1 block text-orange-600">
                                {copy.accent}
                            </span>
                        </h1>
                        <p className="mt-6 max-w-lg text-base leading-8 text-slate-500 sm:text-lg sm:leading-9">
                            {copy.description}
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <Link
                                href="/register"
                                className="welcome-button flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800"
                            >
                                {copy.create}
                                <ArrowUpRight
                                    size={19}
                                    className={
                                        locale === 'ar' ? '-scale-x-100' : ''
                                    }
                                />
                            </Link>
                        </div>
                        <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-slate-500 sm:text-sm">
                            <ShieldCheck
                                size={16}
                                className="mt-1 shrink-0 text-slate-400"
                            />
                            {copy.access}
                        </p>
                    </div>

                    <div
                        className="welcome-preview relative mx-auto w-full max-w-lg min-w-0 p-3 sm:p-6"
                        aria-label={copy.illustration}
                    >
                        <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-[0_24px_70px_-28px_#34476445] sm:p-7">
                            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-700">
                                        <FileText size={21} />
                                    </span>
                                    <span className="text-sm font-bold">
                                        {copy.report}
                                    </span>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-medium text-slate-500 sm:text-xs">
                                    {copy.demo}
                                </span>
                            </div>
                            <div className="mb-5 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-orange-800">
                                    <Mic size={16} />
                                    {copy.audio}
                                </div>
                                <div
                                    className="flex h-12 items-center justify-between gap-1.5"
                                    dir="ltr"
                                    aria-hidden="true"
                                >
                                    {waveform.map((height, index) => (
                                        <span
                                            key={index}
                                            className="w-1.5 rounded-full bg-orange-400"
                                            style={{ height }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-4">
                                <section className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                                    <h2 className="mb-2 text-[11px] font-semibold text-slate-400">
                                        {copy.source}
                                    </h2>
                                    <p
                                        lang="ar"
                                        dir="rtl"
                                        className="text-sm leading-7 text-slate-700"
                                    >
                                        فحصت الفرامل، والتبديل لم يبدأ بعد.
                                    </p>
                                </section>
                                <section className="rounded-2xl border border-slate-100 p-4">
                                    <h2 className="mb-2 text-[11px] font-semibold text-slate-400">
                                        {copy.english}
                                    </h2>
                                    <p
                                        lang="en"
                                        dir="ltr"
                                        className="text-sm leading-6 text-slate-700"
                                    >
                                        I inspected the brakes. Replacement has
                                        not started yet.
                                    </p>
                                </section>
                            </div>
                            <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                                <Camera size={16} className="text-slate-400" />
                                {copy.attachments}
                                <Check
                                    size={15}
                                    className="ms-auto text-orange-500"
                                    aria-hidden="true"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className="grid gap-6 border-t border-slate-200/70 py-9 sm:grid-cols-3 sm:gap-8 lg:py-10"
                    aria-label={
                        locale === 'ar'
                            ? 'كيف يساعد فريقك'
                            : 'Built around your team'
                    }
                >
                    {copy.features.map(([title, body], index) => {
                        const Icon = featureIcons[index];
                        return (
                            <article key={title} className="flex gap-4">
                                <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200/70 bg-white text-orange-600">
                                    <Icon size={19} />
                                </span>
                                <div>
                                    <h2 className="mb-2 text-sm font-bold text-slate-800">
                                        {title}
                                    </h2>
                                    <p className="text-sm leading-7 text-slate-500">
                                        {body}
                                    </p>
                                </div>
                            </article>
                        );
                    })}
                </section>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 py-6 text-xs leading-6 text-slate-400">
                    <p>{copy.footer}</p>
                    <p className="flex items-center gap-2">
                        <ShieldCheck size={14} />
                        {copy.private}
                        <span aria-hidden="true">·</span>
                        {copy.preview}
                    </p>
                </footer>
            </div>
        </main>
    );
}
