<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $version
 * @property string $english_report
 */
class ReportRevision extends Model
{
    protected $guarded = [];
}
