<?php

namespace App\Modules\Identity;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeActivation
{
    public function __construct(private TenantAccess $access) {}

    public function issue(User $actor, int $tenantId, int $membershipId): string
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);

        return DB::transaction(function () use ($employee) {
            $employee = Membership::query()->lockForUpdate()->findOrFail($employee->id);
            abort_unless($employee->active, 409);
            EmployeeInvitation::query()->where('membership_id', $employee->id)->delete();
            $token = Str::random(64);
            EmployeeInvitation::query()->create([
                'tenant_id' => $employee->tenant_id, 'membership_id' => $employee->id,
                'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes(30),
            ]);

            return $token;
        });
    }

    /** @return array{user: User, device: EmployeeDevice, token: string} */
    public function consume(string $token): array
    {
        return DB::transaction(function () use ($token) {
            $hash = hash('sha256', $token);
            $candidate = EmployeeInvitation::query()->where('token_hash', $hash)->first();
            $membership = $candidate ? Membership::query()->lockForUpdate()->find($candidate->membership_id) : null;
            $invitation = EmployeeInvitation::query()->where('token_hash', $hash)->lockForUpdate()->first();
            if (! $membership || ! $membership->active || $membership->role !== 'employee'
                || ! $invitation || $invitation->used_at || $invitation->expires_at->isPast()) {
                throw ValidationException::withMessages(['token' => 'انتهى الرابط أو استُخدم. اطلب رمزًا جديدًا من المدير.']);
            }
            $user = User::query()->findOrFail($membership->user_id);
            abort_unless($user->employee_only && $membership->tenant_id === $invitation->tenant_id, 403);
            $invitation->update(['used_at' => now()]);
            $deviceToken = Str::random(64);
            $device = EmployeeDevice::query()->create([
                'tenant_id' => $membership->tenant_id, 'membership_id' => $membership->id,
                'token_hash' => hash('sha256', $deviceToken), 'expires_at' => now()->addDays(90),
            ]);

            return ['user' => $user, 'device' => $device, 'token' => $deviceToken];
        });
    }
}
