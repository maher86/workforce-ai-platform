<?php

namespace App\Providers;

use App\Modules\AIProcessing\DemoReportAI;
use App\Modules\AIProcessing\OpenAIReportAI;
use App\Modules\AIProcessing\ProcessReport;
use App\Modules\AIProcessing\ReportAI;
use App\Modules\Reporting\ReportSubmitted;
use Carbon\CarbonImmutable;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use RuntimeException;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(ReportAI::class, function () {
            if (config('workforce.ai_provider') === 'openai') {
                return new OpenAIReportAI;
            }
            if (config('workforce.ai_provider') === 'demo' && ! app()->isProduction()) {
                return new DemoReportAI;
            }
            throw new RuntimeException('ai_configuration_required');
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        Event::listen(ReportSubmitted::class, function (ReportSubmitted $event): void {
            try {
                ProcessReport::dispatch($event->tenantId, $event->reportId);
            } catch (Throwable) {
                // The scheduler recovers persisted submitted reports if Redis is unavailable.
                Log::warning('report_dispatch_pending', ['tenant_id' => $event->tenantId, 'report_id' => $event->reportId]);
            }
        });
        $proxy = config('workforce.trusted_proxy');
        if (is_string($proxy) && filter_var($proxy, FILTER_VALIDATE_IP)) {
            TrustProxies::at([$proxy]);
            TrustProxies::withHeaders(Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_PORT);
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
