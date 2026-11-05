<?php

namespace Tests;

use Illuminate\Database\DatabaseManager;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;
use LogicException;

abstract class TestCase extends BaseTestCase
{
    public function createApplication(): Application
    {
        $app = parent::createApplication();
        $connection = $app->make(DatabaseManager::class)->connection();

        // This runs before RefreshDatabase can perform any destructive migrations.
        if (! $app->environment('testing')
            || $connection->getDriverName() !== 'pgsql'
            || $connection->getDatabaseName() !== 'workforce_testing'
            || ! in_array($connection->getConfig('host'), ['postgres', '127.0.0.1', 'localhost'], true)) {
            throw new LogicException('Refusing tests outside the isolated local workforce_testing PostgreSQL database.');
        }

        return $app;
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
