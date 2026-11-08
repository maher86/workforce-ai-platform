<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;

class ReportSourceChange extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['media_ids' => 'array', 'outputs' => 'array'];
    }
}
