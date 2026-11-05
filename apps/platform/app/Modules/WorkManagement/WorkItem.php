<?php

namespace App\Modules\WorkManagement;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $kind
 * @property string $name
 * @property int|null $project_id
 * @property bool $active
 */
class WorkItem extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
