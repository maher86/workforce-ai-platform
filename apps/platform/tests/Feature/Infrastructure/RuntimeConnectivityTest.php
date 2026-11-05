<?php

namespace Tests\Feature\Infrastructure;

use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Fixtures\QueueProbe;
use Tests\TestCase;

class RuntimeConnectivityTest extends TestCase
{
    public function test_database_tests_use_an_isolated_postgresql_database(): void
    {
        $this->assertSame('pgsql', DB::connection()->getDriverName());
        $this->assertSame('workforce_testing', DB::connection()->getDatabaseName());
        $this->assertSame(1, DB::selectOne('SELECT 1 AS value')->value);
    }

    public function test_redis_cache_can_round_trip_an_isolated_value(): void
    {
        $key = 'runtime-test:'.Str::uuid();
        $cache = Cache::store('redis');

        try {
            $cache->put($key, 'synthetic-value', 30);
            $this->assertSame('synthetic-value', $cache->get($key));
        } finally {
            $cache->forget($key);
        }
    }

    public function test_redis_worker_processes_a_serialized_job(): void
    {
        $token = (string) Str::uuid();
        $key = 'queue-probe:'.$token;
        $queue = 'runtime-test-'.$token;
        $cache = Cache::store('redis');

        try {
            Bus::dispatch((new QueueProbe($key))->onConnection('redis')->onQueue($queue));
            $this->assertNull($cache->get($key));

            $this->artisan('queue:work', [
                'connection' => 'redis',
                '--queue' => $queue,
                '--once' => true,
                '--tries' => 1,
                '--timeout' => 20,
            ])->assertSuccessful();

            $this->assertSame('processed', $cache->get($key));
        } finally {
            $cache->forget($key);
            app('queue')->connection('redis')->clear($queue);
        }
    }
}
