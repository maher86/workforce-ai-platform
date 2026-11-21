<?php

namespace App\Modules\Identity;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Notifications\CompanyAdministratorAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ManageWorkforce
{
    public function __construct(private TenantAccess $access) {}

    public function createTenant(User $actor, string $name, ?string $reportingDomain = null): Tenant
    {
        abort_if($actor->employee_only, 403);

        abort_unless($reportingDomain === null || in_array($reportingDomain, ['general', 'automotive'], true), 422);

        return DB::transaction(function () use ($actor, $name, $reportingDomain) {
            $tenant = Tenant::query()->create(['name' => $name, 'reporting_domain' => $reportingDomain ?? config('workforce.reporting_domain')]);
            Membership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $actor->id, 'role' => 'owner']);
            Audit::record($tenant->id, $actor->id, 'tenant.created', 'tenant', $tenant->id);

            return $tenant;
        });
    }

    public function addEmployee(User $actor, int $tenantId, string $name): Membership
    {
        $this->access->manageTeam($actor, $tenantId);

        return DB::transaction(function () use ($actor, $tenantId, $name) {
            $user = new User;
            $user->forceFill([
                'name' => $name,
                // Internal identifier only. Employees never need an email or password.
                'email' => Str::uuid().'@employees.invalid',
                'password' => Str::random(64),
                'employee_only' => true,
            ])->save();

            $member = Membership::query()->create(['tenant_id' => $tenantId, 'user_id' => $user->id, 'role' => 'employee', 'display_name' => $name]);
            Audit::record($tenantId, $actor->id, 'employee.created', 'membership', $member->id);

            return $member;
        });
    }

    public function revokeAccess(User $actor, int $tenantId, int $membershipId, bool $disable = false): void
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);
        DB::transaction(function () use ($actor, $employee, $disable) {
            // All issue/consume/revoke actions lock membership first, then token rows.
            $employee = Membership::query()->where('tenant_id', $employee->tenant_id)->lockForUpdate()->findOrFail($employee->id);
            if ($disable) {
                $employee->update(['active' => false]);
            }
            EmployeeInvitation::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->delete();
            EmployeeDevice::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->whereNull('revoked_at')->update(['revoked_at' => now()]);
            Audit::record($employee->tenant_id, $actor->id, $disable ? 'employee.disabled' : 'devices.revoked', 'membership', $employee->id);
        });
    }

    public function restoreAccess(User $actor, int $tenantId, int $membershipId): Membership
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);
        $employee->update(['active' => true]);
        Audit::record($tenantId, $actor->id, 'employee.enabled', 'membership', $membershipId);

        return $employee;
    }

    public function addManager(User $actor, int $tenantId, string $email, ?string $name = null): void
    {
        $owner = $this->access->manageTeam($actor, $tenantId);
        abort_unless($owner->role === 'owner', 403);
        $email = Str::lower(trim($email));
        $user = DB::transaction(function () use ($actor, $tenantId, $email, $name) {
            Tenant::query()->lockForUpdate()->findOrFail($tenantId);
            $user = User::query()->where('email', $email)->first();
            abort_if($user?->employee_only, 404);
            if ($user === null) {
                $user = User::query()->create(['name' => trim($name ?? '') ?: $email, 'email' => $email, 'password' => Str::random(64)]);
            }
            $member = Membership::query()->where('tenant_id', $tenantId)->where('user_id', $user->id)->first();
            abort_if($member?->role === 'owner', 409);
            $member = Membership::query()->updateOrCreate(['tenant_id' => $tenantId, 'user_id' => $user->id], ['role' => 'manager', 'active' => true]);
            Audit::record($tenantId, $actor->id, 'manager.added', 'membership', $member->id);

            return $user;
        });
        // Never send a password or borrow employee QR credentials. Standard reset and
        // verified-email middleware protect this separate administrator account.
        if ($user->hasVerifiedEmail()) {
            $user->notify(new CompanyAdministratorAccess(Tenant::query()->findOrFail($tenantId)->name));
        } else {
            $status = Password::sendResetLink(['email' => $email], function (User $recipient, string $token) use ($tenantId) {
                $recipient->notify(new CompanyAdministratorAccess(Tenant::query()->findOrFail($tenantId)->name, $token));
            });
            if ($status !== Password::RESET_LINK_SENT) {
                throw ValidationException::withMessages(['email' => __($status)]);
            }
        }
    }

    public function removeManager(User $actor, int $tenantId, int $membershipId): void
    {
        abort_unless($this->access->manageTeam($actor, $tenantId)->role === 'owner', 403);
        DB::transaction(function () use ($actor, $tenantId, $membershipId) {
            $member = Membership::query()->where('tenant_id', $tenantId)->where('role', 'manager')->lockForUpdate()->findOrFail($membershipId);
            $member->update(['active' => false]);
            Audit::record($tenantId, $actor->id, 'manager.disabled', 'membership', $member->id);
        });
    }
}
