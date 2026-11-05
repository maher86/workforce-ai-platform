<?php

namespace App\Modules\Identity;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $name
 */
class Tenant extends Model
{
    protected $guarded = [];
}
