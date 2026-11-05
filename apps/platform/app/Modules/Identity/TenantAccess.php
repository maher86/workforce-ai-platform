<?php

namespace App\Modules\Identity;

use App\Models\User;

class TenantAccess
{
    public function member(User $actor, int $tenantId): Membership
    {
        return Membership::query()->where('tenant_id', $tenantId)
            ->where('user_id', $actor->id)->where('active', true)->firstOrFail();
    }

    public function manageTeam(User $actor, int $tenantId): Membership
    {
        $membership = $this->member($actor, $tenantId);
        abort_unless(in_array($membership->role, ['owner', 'manager'], true) && ! $actor->employee_only, 403);

        return $membership;
    }

    public function employee(User $actor, int $tenantId, int $membershipId): Membership
    {
        $this->manageTeam($actor, $tenantId);

        return Membership::query()->where('tenant_id', $tenantId)
            ->where('role', 'employee')->findOrFail($membershipId);
    }
}
