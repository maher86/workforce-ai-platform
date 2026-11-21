import { Link } from '@inertiajs/react';
import { ArrowUpRight, Building2, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useUiLocale } from '@/hooks/use-ui-locale';

const content = {
    ar: {
        eyebrow: 'خطط مرنة لفريقك',
        title: 'من فريق صغير إلى مؤسسة كبيرة.',
        intro: 'اشتراك حسب عدد الموظفين بالدرهم الإماراتي AED، واستهلاك AI واضح ومنفصل.',
        funding: 'قارن طريقة تغطية استهلاك AI',
        employeeCount: 'كم موظفًا في شركتك؟',
        employeeHint:
            'أدخل من 1 إلى 100,000 موظف لعرض الخطة المقترحة، دون احتساب رسوم.',
        suggested: 'مقترحة لفريقك',
        perEmployee: 'AED / موظف / شهر · السعر لم يُحدّد',
        managed: 'AI مُدار من Workforce',
        company: 'حساب OpenAI الخاص بالشركة',
        recommended: 'الأسهل للبدء',
        planned: 'مخطط له',
        managedTitle: 'نحن ندير الاتصال بـ OpenAI',
        managedBody:
            'تستخدم الشركة خدمة الصوت والترجمة دون إعداد حساب مزوّد. عند إطلاق الفوترة، يظهر اشتراك المنصة واستهلاك AI كبندين منفصلين.',
        companyTitle: 'الشركة تغطي استهلاك OpenAI مباشرة',
        companyBody:
            'يبقى اشتراك المنصة منفصلًا، وتدفع الشركة استهلاك المعالجة عبر حسابها لدى OpenAI. الربط الخاص بكل شركة مخطط له وغير متاح حاليًا.',
        pricingSoon: 'السعر يُعلن قريبًا',
        custom: 'تسعير مخصص',
        subscription: 'اشتراك المنصة',
        usageManaged: '+ استهلاك AI حسب الاستخدام',
        usageCompany: 'استهلاك OpenAI على حساب الشركة · مخطط',
        start: 'ابدأ بحساب شركة',
        common: 'في جميع الخطط المقترحة: تطبيق الموظف، تفعيل QR، صوت مع صور اختيارية، النص الأصلي والإنجليزية، ولوحة إدارة الشركة.',
        usageTitle: 'كيف يُحسب الاستهلاك؟',
        audio: 'الصوت',
        audioBody: 'مدة التسجيل واستهلاك نموذج التفريغ، حسب تسعير النموذج.',
        text: 'الترجمة',
        textBody:
            'توكنات الإدخال والإخراج الفعلية. لا تُعامل كل التوكنات بسعر واحد.',
        budget: 'الميزانية',
        budgetBody:
            'عند إطلاق الفوترة: كشف استخدام للشركة وسقف إنفاق واضح قبل تفعيل أي تكلفة إضافية.',
        note: 'الخطط استرشادية؛ الأسعار والحصص النهائية لم تُعتمد، والدفع غير مفعّل. إنشاء الحساب لا يفعّل خطة مدفوعة أو يربط حساب OpenAI.',
        provider: 'راجع تسعير OpenAI',
        plans: [
            {
                name: 'Basic',
                employees: '1–10 موظفين · تقسيم مقترح',
                description: 'بداية بسيطة لفريق صغير.',
                features: [
                    'تقارير الفريق اليومية',
                    'إدارة الموظفين وتفعيل هواتفهم',
                    'اشتراك حسب عدد الموظفين',
                ],
            },
            {
                name: 'Medium',
                employees: '11–50 موظفًا · تقسيم مقترح',
                description: 'مساحة أكبر لفريق ينمو.',
                features: [
                    'كل أساسيات إدارة التقارير',
                    'اشتراك حسب عدد الموظفين',
                    'متابعة التقارير حسب الموظف والفترة',
                ],
            },
            {
                name: 'Enterprise',
                employees: '51 موظفًا فأكثر · تقسيم مقترح',
                description: 'اتفاق يناسب حجم مؤسستك.',
                features: [
                    'عدد الموظفين وحجم الاستخدام باتفاق خاص',
                    'مراجعة احتياجات التشغيل والدعم',
                    'تسعير يناسب حجم المعالجة',
                ],
            },
        ],
    },
    en: {
        eyebrow: 'Flexible plans for your team',
        title: 'From a small team to a larger business.',
        intro: 'An employee-based subscription in UAE dirhams (AED), with AI usage shown separately.',
        funding: 'Compare AI funding options',
        employeeCount: 'How many employees are on your team?',
        employeeHint:
            'Enter 1 to 100,000 employees to compare the suggested plan, without calculating a charge.',
        suggested: 'Suggested for your team',
        perEmployee: 'AED / employee / month · rate not yet set',
        managed: 'AI managed by Workforce',
        company: 'Your company’s OpenAI account',
        recommended: 'Simplest way to start',
        planned: 'Planned',
        managedTitle: 'We manage the OpenAI connection',
        managedBody:
            'Use speech and translation without setting up a provider account. When billing launches, the platform subscription and AI consumption will appear as separate items.',
        companyTitle: 'Your company funds OpenAI directly',
        companyBody:
            'The platform subscription stays separate, while processing is billed through your company’s OpenAI account. Company-specific connections are planned and not currently available.',
        pricingSoon: 'Pricing coming soon',
        custom: 'Custom pricing',
        subscription: 'Platform subscription',
        usageManaged: '+ usage-based AI processing',
        usageCompany: 'OpenAI usage billed to your company · planned',
        start: 'Start with a company account',
        common: 'All proposed plans: employee app, QR activation, voice with optional photos, original text and English, and your company dashboard.',
        usageTitle: 'How is usage measured?',
        audio: 'Speech',
        audioBody:
            'Recording duration and transcription-model usage, according to the model’s pricing.',
        text: 'Translation',
        textBody:
            'Actual input and output tokens. Different token types do not have one flat price.',
        budget: 'Budget',
        budgetBody:
            'When billing launches: company usage statements and a clear spending cap before extra charges can be enabled.',
        note: 'Plans are indicative; final prices and allowances are not set, and payments are not enabled. Creating an account does not start a paid plan or connect an OpenAI account.',
        provider: 'View OpenAI pricing',
        plans: [
            {
                name: 'Basic',
                employees: '1–10 employees · proposed range',
                description: 'A simple start for a small team.',
                features: [
                    'Daily team reports',
                    'Employee management and phone activation',
                    'Subscription based on employee count',
                ],
            },
            {
                name: 'Medium',
                employees: '11–50 employees · proposed range',
                description: 'More room for a growing team.',
                features: [
                    'Core reporting and team management',
                    'Subscription based on employee count',
                    'Reports by employee and date range',
                ],
            },
            {
                name: 'Enterprise',
                employees: '51+ employees · proposed range',
                description: 'An agreement sized for your business.',
                features: [
                    'Employee volume and usage by agreement',
                    'Review of operational and support needs',
                    'Pricing matched to processing volume',
                ],
            },
        ],
    },
};

export default function PricingSection() {
    const { locale } = useUiLocale();
    const copy = locale === 'en' ? content.en : content.ar;
    const [funding, setFunding] = useState<'managed' | 'company'>('managed');
    const [employees, setEmployees] = useState('25');
    const count = Number(employees);
    const validCount =
        Number.isSafeInteger(count) && count >= 1 && count <= 100000;
    const suggested = !validCount
        ? null
        : count <= 10
          ? 0
          : count <= 50
            ? 1
            : 2;
    return (
        <section
            id="pricing"
            aria-labelledby="pricing-title"
            className="scroll-mt-8 space-y-7 border-t border-slate-200/70 py-12 sm:py-16"
        >
            <header className="mx-auto max-w-2xl space-y-3 text-center">
                <p className="text-xs font-bold tracking-wide text-orange-600">
                    {copy.eyebrow}
                </p>
                <h2
                    id="pricing-title"
                    className="text-3xl leading-snug font-extrabold text-slate-900 sm:text-4xl"
                >
                    {copy.title}
                </h2>
                <p className="text-sm leading-7 text-slate-500 sm:text-base">
                    {copy.intro}
                </p>
            </header>
            <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
                <label
                    htmlFor="pricing-employees"
                    className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-700"
                >
                    {copy.employeeCount}
                    <input
                        id="pricing-employees"
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        inputMode="numeric"
                        dir="ltr"
                        aria-describedby="pricing-employees-hint"
                        aria-invalid={!validCount}
                        value={employees}
                        onChange={(event) => setEmployees(event.target.value)}
                        className="min-h-11 w-28 rounded-xl border border-slate-200 px-3 py-2 text-center text-lg font-bold text-slate-900 focus-visible:outline-2 focus-visible:outline-orange-500"
                    />
                </label>
                <p
                    id="pricing-employees-hint"
                    className="mt-3 text-xs leading-6 text-slate-400"
                >
                    {copy.employeeHint}
                </p>
                <p
                    role="status"
                    className="mt-2 text-sm font-semibold text-orange-700"
                >
                    {validCount && suggested !== null
                        ? `${copy.suggested}: ${copy.plans[suggested].name}`
                        : copy.employeeHint}
                </p>
            </div>
            <div
                role="group"
                aria-label={copy.funding}
                className="mx-auto grid max-w-2xl gap-2 rounded-3xl border border-slate-200 bg-slate-100/70 p-2 sm:grid-cols-2"
            >
                {(['managed', 'company'] as const).map((mode) => (
                    <button
                        type="button"
                        key={mode}
                        aria-pressed={funding === mode}
                        onClick={() => setFunding(mode)}
                        className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${funding === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}
                    >
                        {mode === 'managed' ? (
                            <Sparkles size={18} />
                        ) : (
                            <Building2 size={18} />
                        )}
                        <span>
                            {copy[mode]}
                            <span className="mt-1 block text-[11px] font-normal text-slate-500">
                                {mode === 'managed'
                                    ? copy.recommended
                                    : copy.planned}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
            <div
                aria-live="polite"
                className="mx-auto max-w-3xl rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-center"
            >
                <h3 className="text-sm font-bold text-slate-800">
                    {funding === 'managed'
                        ? copy.managedTitle
                        : copy.companyTitle}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                    {funding === 'managed'
                        ? copy.managedBody
                        : copy.companyBody}
                </p>
            </div>
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
                {copy.plans.map((plan, index) => (
                    <article
                        key={plan.name}
                        className={`relative flex flex-col rounded-[1.75rem] border bg-white p-6 shadow-sm sm:p-7 ${index === suggested ? 'border-orange-300 ring-2 ring-orange-100' : 'border-slate-200'}`}
                    >
                        <div className="mb-5 flex min-h-7 items-center justify-between gap-2">
                            <h3
                                dir="ltr"
                                className="text-2xl font-extrabold text-slate-900"
                            >
                                {plan.name}
                            </h3>
                            {index === suggested && (
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700">
                                    {copy.suggested}
                                </span>
                            )}
                        </div>
                        <p className="min-h-12 text-sm leading-6 text-slate-500">
                            {plan.description}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                            {plan.employees}
                        </p>
                        <div className="my-6 border-y border-slate-100 py-5">
                            <p className="text-xs text-slate-400">
                                {copy.subscription}
                            </p>
                            <p className="mt-2 text-xl font-bold text-slate-900">
                                {index === 2 ? copy.custom : copy.pricingSoon}
                            </p>
                            <p className="mt-2 text-xs leading-6 text-slate-400">
                                {copy.perEmployee}
                            </p>
                            <p className="mt-3 min-h-10 text-xs leading-6 text-slate-500">
                                {funding === 'managed'
                                    ? copy.usageManaged
                                    : copy.usageCompany}
                            </p>
                        </div>
                        <ul className="mb-7 space-y-3">
                            {plan.features.map((feature) => (
                                <li
                                    key={feature}
                                    className="flex items-start gap-2 text-sm leading-6 text-slate-600"
                                >
                                    <Check
                                        size={17}
                                        className="mt-1 shrink-0 text-orange-500"
                                        aria-hidden="true"
                                    />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/register"
                            className={`mt-auto flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-center text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 ${index === suggested ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 text-slate-800 hover:border-orange-300'}`}
                        >
                            {copy.start}
                            <ArrowUpRight
                                size={16}
                                className={
                                    locale === 'ar' ? '-scale-x-100' : ''
                                }
                            />
                        </Link>
                    </article>
                ))}
            </div>
            <p className="mx-auto max-w-3xl text-center text-sm leading-7 text-slate-500">
                {copy.common}
            </p>
            <div className="rounded-3xl border border-slate-200 bg-white/80 p-6">
                <h3 className="mb-5 text-lg font-bold text-slate-900">
                    {copy.usageTitle}
                </h3>
                <div className="grid gap-5 sm:grid-cols-3">
                    {[
                        ['audio', 'audioBody'],
                        ['text', 'textBody'],
                        ['budget', 'budgetBody'],
                    ].map(([title, body]) => (
                        <div key={title}>
                            <h4 className="mb-2 text-sm font-semibold text-slate-800">
                                {copy[title as 'audio' | 'text' | 'budget']}
                            </h4>
                            <p className="text-sm leading-7 text-slate-500">
                                {
                                    copy[
                                        body as
                                            | 'audioBody'
                                            | 'textBody'
                                            | 'budgetBody'
                                    ]
                                }
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            <p className="mx-auto max-w-3xl text-center text-xs leading-6 text-slate-400">
                {copy.note}{' '}
                <a
                    href="https://developers.openai.com/api/docs/pricing"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-slate-600 underline underline-offset-4"
                >
                    {copy.provider}
                </a>
            </p>
        </section>
    );
}
