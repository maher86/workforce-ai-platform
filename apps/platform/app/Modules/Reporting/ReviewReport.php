<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\TenantAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewReport
{
    public function __construct(private TenantAccess $access) {}

    public function execute(User $actor, int $tenantId, int $reportId, int $version, string $english, string $reason, string $status): void
    {
        $this->access->manageTeam($actor, $tenantId);
        if (! in_array($status, ['approved', 'changes_requested'], true) || trim($reason) === '' || trim($english) === '' || mb_strlen($english) > 30000 || mb_strlen($reason) > 2000) {
            throw ValidationException::withMessages(['review' => 'أضف التقرير وسبب المراجعة.']);
        }
        DB::transaction(function () use ($actor, $tenantId, $reportId, $version, $english, $reason, $status) {
            $report = Report::query()->where('tenant_id', $tenantId)->lockForUpdate()->findOrFail($reportId);
            if ($report->version !== $version || ! in_array($report->status, ['ready', 'failed'], true)) {
                throw ValidationException::withMessages(['review' => 'تغيّر التقرير أو لم تكتمل المعالجة. أعد تحميل الصفحة.']);
            }
            ReportRevision::query()->create([
                'tenant_id' => $tenantId, 'report_id' => $reportId, 'actor_id' => $actor->id,
                'source_version' => $report->source_version, 'version' => $version + 1, 'status' => $status, 'english_report' => $english, 'reason' => $reason,
            ]);
            $report->update(['source_version' => $report->source_version, 'version' => $version + 1, 'review_status' => $status]);
            Audit::record($tenantId, $actor->id, 'report.'.$status, 'report', $reportId);
        });
    }
}
