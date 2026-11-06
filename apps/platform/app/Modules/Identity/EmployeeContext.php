<?php

namespace App\Modules\Identity;

use App\Models\User;

class EmployeeContext
{
    public function resolve(User $user, int $deviceId): Membership
    {
        abort_unless($user->employee_only, 403);
        $device = EmployeeDevice::query()->whereNull('revoked_at')->where('expires_at', '>', now())->findOrFail($deviceId);

        return Membership::query()->where('tenant_id', $device->tenant_id)->where('user_id', $user->id)
            ->where('active', true)->where('role', 'employee')->findOrFail($device->membership_id);
    }
}
