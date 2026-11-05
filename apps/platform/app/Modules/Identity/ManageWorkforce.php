<?php

namespace App\Modules\Identity;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ManageWorkforce
{
    public function __construct(private TenantAccess $access) {}

    public function createTenant(User $actor, string $name): Tenant
    {
        abort_if($actor->employee_only, 403);

        return DB::transaction(function () use ($actor, $name) {
            $tenant = Tenant::query()->create(['name' => $name]);
            Membership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $actor->id, 'role' => 'owner']);

            return $tenant;
        });
    }

    public function addEmployee(User $actor, int $tenantId, string $name): Membership
    {
        $this->access->manageTeam($actor, $tenantId);

        return DB::transaction(function () use ($tenantId, $name) {
            $user = new User;
            $user->forceFill([
                'name' => $name,
                // Internal identifier only. Employees never need an email or password.
                'email' => Str::uuid().'@employees.invalid',
                'password' => Str::random(64),
                'employee_only' => true,
            ])->save();

            return Membership::query()->create(['tenant_id' => $tenantId, 'user_id' => $user->id, 'role' => 'employee']);
        });
    }

    public function revokeAccess(User $actor, int $tenantId, int $membershipId, bool $disable = false): void
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);
        DB::transaction(function () use ($employee, $disable) {
            // All issue/consume/revoke actions lock membership first, then token rows.
            $employee = Membership::query()->lockForUpdate()->findOrFail($employee->id);
            if ($disable) {
                $employee->update(['active' => false]);
            }
            EmployeeInvitation::query()->where('membership_id', $employee->id)->delete();
            EmployeeDevice::query()->where('membership_id', $employee->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
        });
    }
}
