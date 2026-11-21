<?php

namespace App\Modules\Identity;

use App\Models\User;

class TenantAccess
{
    public function managementTenant(User $actor): ?int
    {
        abort_if($actor->employee_only || $actor->platform_admin, 403);
        if ($actor->company_id !== null) {
            return $actor->company_id;
        }
        $ids = Membership::query()->where('user_id', $actor->id)->where('active', true)->whereIn('role', ['owner', 'manager'])->distinct()->pluck('tenant_id');
        abort_if($ids->count() > 1, 409, 'This legacy account needs its company binding resolved by the platform operator.');

        return $ids->isEmpty() ? null : (int) $ids->first();
    }

    public function member(User $actor, int $tenantId): Membership
    {
        abort_if($actor->platform_admin, 403);
        $member = Membership::query()->where('tenant_id', $tenantId)
            ->where('user_id', $actor->id)->where('active', true)->firstOrFail();
        if (in_array($member->role, ['owner', 'manager'], true)) {
            abort_unless($this->managementTenant($actor) === $tenantId, 404);
        }

        return $member;
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
