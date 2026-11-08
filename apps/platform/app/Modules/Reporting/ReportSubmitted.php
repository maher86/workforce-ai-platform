<?php

namespace App\Modules\Reporting;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

final readonly class ReportSubmitted implements ShouldDispatchAfterCommit
{
    public function __construct(public int $tenantId, public int $reportId, public int $sourceVersion = 1) {}
}
