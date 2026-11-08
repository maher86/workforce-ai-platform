<?php

namespace App\Modules\AIProcessing;

use App\Modules\Audit\Audit;
use App\Modules\Identity\Membership;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportLocks;
use App\Modules\Reporting\ReportOutput;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class ProcessReport implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public int $sourceVersion = 1;

    public function __construct(public int $tenantId, public int $reportId, int $sourceVersion = 1)
    {
        $this->sourceVersion = $sourceVersion;
    }

    /** @return list<int> */
    public function backoff(): array
    {
        return [10, 30, 90];
    }

    public function handle(ReportPipeline $pipeline, ReportAI $ai): void
    {
        $lock = ReportLocks::make($this->tenantId, $this->reportId);
        if (! $lock->get()) {
            $this->release(5);

            return;
        }
        try {
            $report = Report::query()->where('tenant_id', $this->tenantId)->find($this->reportId);
            if (! $report || $report->source_version !== $this->sourceVersion || in_array($report->status, ['ready', 'failed'], true)) {
                return;
            }
            $active = Membership::query()->where('tenant_id', $this->tenantId)->where('active', true)->whereKey($report->membership_id)->exists();
            if (! $active) {
                $report->update(['status' => 'failed', 'failure_code' => 'membership_inactive']);

                return;
            }
            $report->update(['status' => 'processing', 'processing_started_at' => now()]);
            $stage = $pipeline->next($report);
            if ($stage === null) {
                $report->update(['status' => 'ready', 'failure_code' => null, 'processing_started_at' => null]);
                Audit::record($this->tenantId, null, 'report.ready', 'report', $report->id);

                return;
            }
            $result = $stage['kind'] === 'structured' && $pipeline->sources($report) === []
                ? new StageResult(['summary' => 'Image-only submission. Supporting observations require human review; no quantities or completion are established.', 'claims' => [], 'uncertainties' => ['No employee text or speech provides work quantities or completion claims.']], 'image-only-policy-v1', [], 'policy')
                : $ai->run($stage['kind'], $stage['context']);
            $pipeline->validate($report, $stage['kind'], $result->payload);
            DB::transaction(function () use ($report, $stage, $result) {
                $current = Report::query()->where('tenant_id', $this->tenantId)->lockForUpdate()->find($report->id);
                if (! $current || $current->source_version !== $report->source_version || $current->status === 'failed' || ! Membership::query()->where('tenant_id', $this->tenantId)->where('active', true)->whereKey($current->membership_id)->exists()) {
                    return;
                }
                ReportOutput::query()->firstOrCreate(['report_id' => $report->id, 'stage' => $stage['key']], [
                    'tenant_id' => $this->tenantId, 'provider' => $result->provider ?? (string) config('workforce.ai_provider'),
                    'model' => $result->model, 'prompt_version' => 'workforce-v1', 'schema_version' => '1',
                    'payload' => $result->payload, 'usage' => $result->usage,
                ]);
                $current->touch();
            });
        } catch (Throwable) {
            // Queue exception payloads must never contain employee evidence/API responses.
            throw new RuntimeException('report_stage_failed');
        } finally {
            $lock->release();
        }
        // One API stage per bounded job; persisted stages survive retries/restarts.
        self::dispatch($this->tenantId, $this->reportId, $this->sourceVersion);
    }

    public function failed(?Throwable $exception): void
    {
        $changed = Report::query()->where('tenant_id', $this->tenantId)->whereKey($this->reportId)->where('source_version', $this->sourceVersion)->where('status', '!=', 'ready')
            ->update(['status' => 'failed', 'failure_code' => 'processing_failed', 'processing_started_at' => null]);
        if ($changed > 0) {
            Audit::record($this->tenantId, null, 'report.failed', 'report', $this->reportId);
        }
    }
}
