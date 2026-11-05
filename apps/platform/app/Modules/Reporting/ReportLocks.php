<?php

namespace App\Modules\Reporting;

use Illuminate\Cache\Repository;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class ReportLocks
{
    public static function make(int $tenantId, int $reportId): Lock
    {
        $cache = Cache::store('redis');
        if (! $cache instanceof Repository || ! $cache->getStore() instanceof LockProvider) {
            throw new RuntimeException('report_lock_unavailable');
        }

        return $cache->getStore()->lock('workforce:'.app()->environment().':tenant:'.$tenantId.':report:'.$reportId, 90);
    }
}
