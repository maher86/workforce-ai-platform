<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneEmployeeDeviceProofs extends Command
{
    protected $signature = 'devices:prune-proofs';

    protected $description = 'Remove expired replay records in bounded batches; never remove devices';

    public function handle(): int
    {
        // The scheduler is a system actor. Resolve each selected row's tenant before mutation.
        $rows = DB::table('employee_device_proofs')->where('expires_at', '<', now())->orderBy('id')->limit(5000)->get(['id', 'tenant_id']);
        foreach ($rows->groupBy('tenant_id') as $tenantId => $proofs) {
            DB::table('employee_device_proofs')->where('tenant_id', $tenantId)->whereIn('id', $proofs->pluck('id'))->where('expires_at', '<', now())->delete();
        }

        return self::SUCCESS;
    }
}
