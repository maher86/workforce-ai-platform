<?php

$applicationRoot = realpath(__DIR__.'/../apps/platform') ?: '/var/www/html';
require $applicationRoot.'/vendor/autoload.php';
$app = require $applicationRoot.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
use App\Models\User;
use App\Modules\AIProcessing\DemoReportAI;
use App\Modules\AIProcessing\ProcessReport;
use App\Modules\AIProcessing\ReportAI;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

if (! app()->environment('testing') || DB::connection()->getDatabaseName() !== 'workforce_testing' || (int) config('database.redis.default.database') !== 3 || ! str_starts_with((string) config('database.redis.options.prefix'), 'capacity_') || ! (app(ReportAI::class) instanceof DemoReportAI) || filled(config('workforce.openai_key'))) {
    echo "Capacity guard failed.\n";
    exit(1);
}
$label = 'Synthetic capacity '.Str::uuid();
$tenants = [];
$users = [];
$reports = [];
$workers = [];
$success = false;
try {
    $work = app(ManageWorkforce::class);
    for ($t = 0; $t < 2; $t++) {
        $owner = User::factory()->create(['name' => $label.' owner '.$t]);
        $users[] = $owner->id;
        $tenant = $work->createTenant($owner, $label.' '.$t);
        $tenants[] = $tenant->id;
        for ($i = 0; $i < 25; $i++) {
            $member = $work->addEmployee($owner, $tenant->id, $label.' employee '.$i);
            $users[] = $member->user_id;
            $r = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64), 'analysis_mode' => 'text']);
            ReportMedia::query()->create(['tenant_id' => $tenant->id, 'report_id' => $r->id, 'kind' => 'audio', 'path' => $tenant->id.'/'.$r->id.'/synthetic-capacity-'.Str::uuid().'.m4a', 'mime' => 'audio/mp4', 'bytes' => 1, 'duration' => 1, 'sha256' => str_repeat('b', 64)]);
            $reports[] = $r;
        }
    }
    $failedBefore = DB::table('failed_jobs')->count();
    foreach ($reports as $r) {
        ProcessReport::dispatch($r->tenant_id, $r->id, 1);
        ProcessReport::dispatch($r->tenant_id, $r->id, 1);
    }
    ProcessReport::dispatch($tenants[1], $reports[0]->id, 1);
    ProcessReport::dispatch($tenants[0], $reports[25]->id, 1);
    $started = microtime(true);
    for ($i = 0; $i < 2; $i++) {
        $p = new Process(['php', 'artisan', 'queue:work', 'redis', '--queue=report-text,default', '--tries=3', '--timeout=60', '--sleep=1'], $applicationRoot);
        $p->setTimeout(240);
        $p->start();
        $workers[] = $p;
    }
    $ids = array_map(fn ($r) => $r->id, $reports);
    do {
        foreach ($workers as $p) {
            if (! $p->isRunning()) {
                throw new RuntimeException('Synthetic worker stopped unexpectedly');
            }
        }
        $readyNow = Report::query()->whereIn('id', $ids)->where('status', 'ready')->count();
        $remainingNow = Queue::connection('redis')->size('default') + Queue::connection('redis')->size(ProcessReport::TEXT_QUEUE);
        if ($readyNow === 50 && $remainingNow === 0) {
            break;
        }
        if (microtime(true) - $started > 180) {
            throw new RuntimeException('Synthetic capacity deadline exceeded');
        }
        usleep(200000);
    } while (true);
    foreach ($workers as $p) {
        $p->stop(5);
    }
    $ids = array_map(fn ($r) => $r->id, $reports);
    $ready = Report::query()->whereIn('id', $ids)->where('status', 'ready')->count();
    $outputs = ReportOutput::query()->whereIn('report_id', $ids)->count();
    $bad = ReportOutput::query()->join('reports', 'reports.id', '=', 'report_outputs.report_id')->whereIn('report_outputs.report_id', $ids)->whereColumn('report_outputs.tenant_id', '!=', 'reports.tenant_id')->count();
    $remaining = Queue::connection('redis')->size('default') + Queue::connection('redis')->size(ProcessReport::TEXT_QUEUE);
    $newFailures = DB::table('failed_jobs')->count() - $failedBefore;
    if ($ready !== 50 || $outputs !== 100 || $bad !== 0 || $remaining !== 0 || $newFailures !== 0) {
        throw new RuntimeException('Synthetic capacity assertions failed');
    }
    echo json_encode(['synthetic_employees' => 50, 'tenants' => 2, 'workers' => 2, 'initial_jobs_with_duplicates_and_forged_tenants' => 102, 'ready_reports' => $ready, 'stored_text_outputs' => $outputs, 'cross_tenant_outputs' => $bad, 'remaining_jobs' => $remaining, 'new_failed_jobs' => $newFailures, 'queue_drain_seconds' => round(microtime(true) - $started, 2), 'provider' => 'demo', 'real_audio_decode_or_api_load_test' => false], JSON_THROW_ON_ERROR).PHP_EOL;
    $success = true;
} catch (Throwable) {
    echo "Synthetic capacity probe failed; details redacted.\n";
} finally {
    foreach ($workers as $p) {
        if ($p->isRunning()) {
            $p->stop(2);
        }
    }
    Queue::connection('redis')->clear('default');
    Queue::connection('redis')->clear(ProcessReport::TEXT_QUEUE);
    foreach ($tenants as $id) {
        DB::table('tenants')->where('id', $id)->where('name', 'like', $label.'%')->delete();
    }
    User::query()->whereIn('id', $users)->where('name','like',$label.'%')->delete();
    echo "Synthetic capacity fixtures and isolated queues cleaned.\n";
}
exit($success ? 0 : 1);
