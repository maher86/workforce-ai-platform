<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;

/** @property int $version */
class ReportServiceFact extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['rework' => 'boolean', 'started_at' => 'immutable_datetime', 'ended_at' => 'immutable_datetime'];
    }
}
