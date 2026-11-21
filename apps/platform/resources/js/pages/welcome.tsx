import { Head, Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    AudioLines,
    ClipboardList,
    Languages,
    Mic,
    ShieldCheck,
} from 'lucide-react';
import ManagerLanguageSwitch from '@/components/manager-language-switch';
import PricingSection from '@/components/pricing-section';
import WorkflowStory from '@/components/workflow-story';
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
    },
};
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
                        <a
                            href="#pricing"
                            className="welcome-link min-h-11 content-center rounded-xl px-1 text-sm font-semibold text-slate-700 sm:px-3"
                        >
                            {locale === 'ar' ? 'الخطط' : 'Plans'}
                        </a>
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

                    <div className="welcome-preview relative mx-auto w-full max-w-lg min-w-0 p-3 sm:p-6">
                        <WorkflowStory />
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
                <PricingSection />
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
