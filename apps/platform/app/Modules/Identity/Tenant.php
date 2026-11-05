<?php

namespace App\Modules\Identity;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 * @property int $daily_report_limit
 * @property int $storage_limit_mb
 * @property int $retention_days
 */
class Tenant extends Model
{
    protected $guarded = [];
}
