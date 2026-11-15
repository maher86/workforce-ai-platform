<?php

use App\Models\User;
use App\Modules\AIProcessing\DemoReportAI;
use App\Modules\AIProcessing\ReportAI;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\ManageWorkforce;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

$root = realpath(__DIR__.'/../apps/platform') ?: '/var/www/html';
require $root.'/vendor/autoload.php';
$app = require $root.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (! app()->environment('testing') || DB::connection()->getDriverName() !== 'pgsql'
    || DB::connection()->getDatabaseName() !== 'workforce_testing'
    || ! (app(ReportAI::class) instanceof DemoReportAI) || filled(config('workforce.openai_key'))) {
    echo "Device probe guard failed.\n";
    exit(1);
}

// Child actors share the same guarded database, never migrations or credential output.
if (($argv[1] ?? '') === 'actor') {
    $data = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    DB::select("SELECT set_config('application_name', ?, false)", [$data['name']]);
    try {
        $service = app(EmployeeActivation::class);
        if ($data['action'] === 'consume') {
            $service->consume($data['token']);
        } else {
            $service->transfer(User::query()->findOrFail($data['owner']), $data['tenant'], $data['member'], $data['device'], 'browser');
        }
        echo "SUCCESS\n";
    } catch (ValidationException) {
        echo "DENIED\n";
    }
    exit(0);
}

$label = 'Synthetic device race '.Str::uuid();
$tenant = null;
$users = [];
$actors = [];
$success = false;
try {
    $owner = User::factory()->create(['name' => $label.' owner']);
    $users[] = $owner->id;
    $work = app(ManageWorkforce::class);
    $tenant = $work->createTenant($owner, $label);
    $member = $work->addEmployee($owner, $tenant->id, $label.' employee');
    $users[] = $member->user_id;
    $service = app(EmployeeActivation::class);
    $token = $service->issue($owner, $tenant->id, $member->id);
    foreach (['consume', 'transfer'] as $action) {
        $names = [];
        $actors = [];
        $device = EmployeeDevice::query()->where('tenant_id', $tenant->id)->where('membership_id', $member->id)->whereNull('revoked_at')->value('id');
        DB::beginTransaction();
        DB::table('memberships')->where('tenant_id', $tenant->id)->where('id', $member->id)->lockForUpdate()->first();
        for ($i = 0; $i < 2; $i++) {
            $name = 'device_probe_'.Str::random(16);
            $names[] = $name;
            $actor = new Process([PHP_BINARY, __FILE__, 'actor'], $root);
            $actor->setInput(json_encode(['name' => $name, 'action' => $action, 'token' => $token, 'owner' => $owner->id,
                'tenant' => $tenant->id, 'member' => $member->id, 'device' => $device], JSON_THROW_ON_ERROR));
            $actor->setTimeout(40);
            $actor->start();
            $actors[] = $actor;
        }
        $deadline = microtime(true) + 25;
        do {
            // Prove both actors reached the contested membership lock before releasing it.
            DB::select('SELECT pg_stat_clear_snapshot()');
            $waiting = DB::table('pg_stat_activity')->whereIn('application_name', $names)->where('wait_event_type', 'Lock')->count();
            if ($waiting === 2) {
                break;
            }
            if (microtime(true) >= $deadline || ! $actors[0]->isRunning() || ! $actors[1]->isRunning()) {
                throw new RuntimeException('Actors failed to reach contested lock');
            }
            usleep(50000);
        } while (true);
        DB::commit();
        $results = [];
        foreach ($actors as $actor) {
            if ($actor->wait() !== 0) {
                throw new RuntimeException('Actor failed');
            }
            $results[] = trim($actor->getOutput());
        }
        sort($results);
        if ($results !== ['DENIED', 'SUCCESS']) {
            throw new RuntimeException('Race did not admit exactly one actor');
        }
        $active = EmployeeDevice::query()->where('tenant_id', $tenant->id)->where('membership_id', $member->id)->whereNull('revoked_at')->count();
        if ($active !== ($action === 'consume' ? 1 : 0)) {
            throw new RuntimeException('Wrong active-device count');
        }
        echo $action.": two concurrent actors, one success, one denial.\n";
    }
    $success = true;
} catch (Throwable $exception) {
    echo 'Device race probe failed: '.get_class($exception).'.'.PHP_EOL;
    if ($exception instanceof RuntimeException && ! $exception instanceof \Illuminate\Database\QueryException) {
        echo $exception->getMessage().PHP_EOL;
    }
} finally {
    while (DB::transactionLevel() > 0) {
        DB::rollBack();
    }
    foreach ($actors as $actor) {
        if ($actor->isRunning()) {
            $actor->stop(2);
        }
    }
    if ($tenant) {
        DB::table('tenants')->where('id', $tenant->id)->where('name', $label)->delete();
    }
    User::query()->whereIn('id', $users)->where('name', 'like', $label.'%')->delete();
    echo "Synthetic device fixtures cleaned.\n";
}
exit($success ? 0 : 1);
