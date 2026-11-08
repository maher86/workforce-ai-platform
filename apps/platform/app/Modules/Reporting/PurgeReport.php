<?php

namespace App\Modules\Reporting;

use App\Modules\Audit\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PurgeReport
{
    public function execute(int $tenantId, int $reportId, ?int $actorId): void
    {
        ReportLocks::make($tenantId, $reportId)->block(5, function () use ($tenantId, $reportId, $actorId) {
            DB::transaction(function () use ($tenantId, $reportId, $actorId) {
                $report = Report::withTrashed()->where('tenant_id', $tenantId)->lockForUpdate()->findOrFail($reportId);
                $paths = ReportMedia::query()->where('tenant_id', $tenantId)->where('report_id', $reportId)->pluck('path')->all();
                Storage::disk('reports')->delete($paths);
                $report->forceDelete();
                Audit::record($tenantId, $actorId, 'report.deleted', 'report', $reportId);
            });
        });
    }
}
