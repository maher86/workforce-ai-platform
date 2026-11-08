<?php

namespace App\Console\Commands;

use App\Modules\AIProcessing\ProcessReport;
use App\Modules\Reporting\Report;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class RecoverReports extends Command
{
    protected $signature = 'reports:recover';

    protected $description = 'Recover bounded batches of submitted/stale processing reports';

    public function handle(): int
    {
        $items = Report::query()->where(function ($query) {
            $query->where(fn ($submitted) => $submitted->where('status', 'submitted')->where('updated_at', '<', now()->subMinute()))
                ->orWhere(fn ($processing) => $processing->where('status', 'processing')->where('updated_at', '<', now()->subMinutes(5)));
        })->orderBy('id')->limit(100)->get();
        foreach ($items as $report) {
            if (Cache::store('redis')->add('workforce:'.app()->environment().':tenant:'.$report->tenant_id.':recover:'.$report->id, true, 60)) {
                ProcessReport::dispatch($report->tenant_id, $report->id, $report->source_version);
            }
        }
        $this->info('Recovery scan completed.');

        return self::SUCCESS;
    }
}
