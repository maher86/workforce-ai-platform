<?php

namespace App\Modules\Identity;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $user_id
 * @property string $role
 * @property bool $active
 * @property string|null $phone
 * @property string|null $display_name
 * @property string|null $profile_photo_path
 */
class Membership extends Model
{
    protected $guarded = [];

    protected $hidden = ['profile_photo_path'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
