<?php

namespace App\Console\Commands;

use App\Modules\Identity\Tenant;
use App\Modules\Reporting\PurgeReport;
use App\Modules\Reporting\Report;
use Illuminate\Console\Command;

class PurgeExpiredReports extends Command
{
    protected $signature = 'reports:purge {--apply : Delete expired reports and private media; default is dry run}';

    protected $description = 'Apply per-tenant report retention in bounded batches';

    public function handle(PurgeReport $purge): int
    {
        $count = 0;
        foreach (Tenant::query()->orderBy('id')->cursor() as $tenant) {
            $reports = Report::withTrashed()->where('tenant_id', $tenant->id)->where('created_at', '<', now()->subDays(max(1, $tenant->retention_days)))->orderBy('id')->limit(100)->get();
            foreach ($reports as $report) {
                $count++;
                if ($this->option('apply')) {
                    $purge->execute($tenant->id, $report->id, null);
                }
            }
        }
        $this->info(($this->option('apply') ? 'Deleted' : 'Dry run; eligible').': '.$count);

        return self::SUCCESS;
    }
}
