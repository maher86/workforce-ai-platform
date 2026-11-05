<?php

namespace App\Console\Commands;

use App\Modules\Reporting\ReportMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneOrphanMedia extends Command
{
    protected $signature = 'reports:prune-orphans {--apply : Delete old unreferenced generated files}';

    protected $description = 'Clean interrupted uploads without touching referenced report media';

    public function handle(): int
    {
        $disk = Storage::disk('reports');
        $count = 0;
        foreach ($disk->allFiles() as $path) {
            if (! preg_match('~^(?:\.incoming|[0-9]+/[0-9]+)/[0-9a-f-]{36}\.(?:jpg|m4a)$~', $path) || $disk->lastModified($path) >= now()->subDay()->getTimestamp()) {
                continue;
            }
            $tenantId = (int) explode('/', $path)[0];
            if (! str_starts_with($path, '.incoming/') && ReportMedia::query()->where('tenant_id', $tenantId)->where('path', $path)->exists()) {
                continue;
            }
            $count++;
            if ($this->option('apply')) {
                $disk->delete($path);
            }
            if ($count >= 1000) {
                break;
            }
        }
        $this->info(($this->option('apply') ? 'Deleted orphans' : 'Dry run; orphan candidates').': '.$count);

        return self::SUCCESS;
    }
}
