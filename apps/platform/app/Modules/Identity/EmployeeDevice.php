<?php

namespace App\Modules\Identity;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $membership_id
 * @property string $token_hash
 * @property Carbon $expires_at
 * @property Carbon|null $revoked_at
 * @property string $binding_type
 * @property string|null $public_key
 */
class EmployeeDevice extends Model
{
    protected $guarded = [];

    protected $hidden = ['token_hash', 'public_key'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'revoked_at' => 'datetime'];
    }
}
