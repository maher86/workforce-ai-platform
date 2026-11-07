<?php

namespace App\Modules\WorkManagement;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $plate
 * @property string $plate_key
 */
class Vehicle extends Model
{
    protected $guarded = [];
}
