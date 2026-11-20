<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Identity\TenantAccess;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Str;

class FindUploadReceipt
{
    public function __construct(private TenantAccess $access) {}

    public function execute(User $actor, int $tenantId, string $key, ?int $reportId = null, ?int $sourceVersion = null): Report
    {
        $member = $this->access->member($actor, $tenantId);
        abort_unless($member->role === 'employee' && Str::isUuid($key), 403);
        $query = Report::query()->where('tenant_id', $tenantId)->where('membership_id', $member->id)
            ->select(['id', 'status', 'source_version']);
        if ($reportId === null) {
            $query->where('submission_key', $key)->where('source_version', 1);
        } else {
            abort_unless($sourceVersion !== null && $sourceVersion >= 1 && $sourceVersion <= 20, 422);
            $query->whereKey($reportId)->where('source_version', $sourceVersion + 1)
                ->whereExists(function (Builder $changes) use ($tenantId, $key, $sourceVersion) {
                    $changes->selectRaw('1')->from('report_source_changes')->where('tenant_id', $tenantId)
                        ->whereColumn('report_id', 'reports.id')->where('change_key', $key)
                        ->where('source_version', $sourceVersion)->where('kind', 'edit');
                });
        }

        // Missing, foreign, withdrawn and superseded receipts are indistinguishable.
        return $query->firstOrFail();
    }
}
