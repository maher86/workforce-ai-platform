<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Identity\TenantAccess;

class ReportAccess
{
    public function __construct(private TenantAccess $access) {}

    public function view(User $actor, int $tenantId, int $reportId): Report
    {
        $membership = $this->access->member($actor, $tenantId);
        $query = Report::query()->where('tenant_id', $tenantId);
        if ($membership->role === 'employee' || $actor->employee_only) {
            $query->where('membership_id', $membership->id);
        }

        return $query->findOrFail($reportId);
    }
}
