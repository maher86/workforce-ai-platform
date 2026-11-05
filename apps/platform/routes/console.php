<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('reports:recover')->everyMinute()->withoutOverlapping();
Schedule::command('reports:purge --apply')->dailyAt('02:00')->withoutOverlapping();
Schedule::command('reports:prune-orphans --apply')->dailyAt('03:00')->withoutOverlapping();
