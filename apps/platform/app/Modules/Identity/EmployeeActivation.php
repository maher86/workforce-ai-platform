<?php

namespace App\Modules\Identity;

use App\Models\User;
use App\Modules\Audit\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeActivation
{
    public function __construct(private TenantAccess $access) {}

    public function issue(User $actor, int $tenantId, int $membershipId, string $deviceMode = 'browser'): string
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);

        return DB::transaction(function () use ($actor, $employee, $deviceMode) {
            $employee = Membership::query()->where('tenant_id', $employee->tenant_id)->lockForUpdate()->findOrFail($employee->id);
            abort_unless($employee->active, 409);
            $this->retireExpired($employee);
            if (EmployeeDevice::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->whereNull('revoked_at')->exists()) {
                throw ValidationException::withMessages(['device' => 'الحساب مرتبط بجهاز. استخدم نقل الحساب إلى جهاز جديد.']);
            }

            return $this->mint($actor, $employee, $deviceMode);
        });
    }

    public function transfer(User $actor, int $tenantId, int $membershipId, int $expectedDeviceId, string $deviceMode): string
    {
        $employee = $this->access->employee($actor, $tenantId, $membershipId);

        return DB::transaction(function () use ($actor, $employee, $expectedDeviceId, $deviceMode) {
            $employee = Membership::query()->where('tenant_id', $employee->tenant_id)->lockForUpdate()->findOrFail($employee->id);
            abort_unless($employee->active, 409);
            $current = EmployeeDevice::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->whereNull('revoked_at')->lockForUpdate()->first();
            if (! $current || $current->id !== $expectedDeviceId) {
                throw ValidationException::withMessages(['device' => 'تغيّر الجهاز المعتمد. حدّث الصفحة قبل نقل الحساب.']);
            }
            $current->update(['revoked_at' => now()]);
            Audit::record($employee->tenant_id, $actor->id, 'device.transfer_revoked', 'device', $current->id);

            return $this->mint($actor, $employee, $deviceMode);
        });
    }

    private function retireExpired(Membership $employee): void
    {
        EmployeeDevice::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->whereNull('revoked_at')->where('expires_at', '<=', now())->update(['revoked_at' => now()]);
    }

    private function mint(User $actor, Membership $employee, string $deviceMode): string
    {
        abort_unless(in_array($deviceMode, ['android', 'browser'], true), 422);
        EmployeeInvitation::query()->where('tenant_id', $employee->tenant_id)->where('membership_id', $employee->id)->delete();
        $token = Str::random(64);
        EmployeeInvitation::query()->create([
            'tenant_id' => $employee->tenant_id, 'membership_id' => $employee->id,
            'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes(30), 'device_mode' => $deviceMode,
        ]);
        Audit::record($employee->tenant_id, $actor->id, 'activation.issued', 'membership', $employee->id);

        return $token;
    }

    /** @return array{user: User, device: EmployeeDevice, token: string} */
    public function consume(string $token, ?string $publicKey = null, ?string $signature = null): array
    {
        return DB::transaction(function () use ($token, $publicKey, $signature) {
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
            $this->retireExpired($membership);
            if (EmployeeDevice::query()->where('tenant_id', $membership->tenant_id)->where('membership_id', $membership->id)->whereNull('revoked_at')->exists()) {
                throw ValidationException::withMessages(['token' => 'الحساب مرتبط بجهاز آخر. اطلب نقل الحساب من المدير.']);
            }
            $mode = $invitation->getAttribute('device_mode');
            if ($mode === 'android' && (! is_string($publicKey) || ! is_string($signature) || ! DeviceKey::verify($publicKey, DeviceKey::activationMessage($token, $publicKey), $signature))) {
                throw ValidationException::withMessages(['token' => 'هذا الرمز لتطبيق Android المرتبط بالجهاز. حدّث التطبيق وافتح الرمز داخله. [DEVICE-KEY]']);
            }
            $invitation->update(['used_at' => now()]);
            $deviceToken = Str::random(64);
            $device = EmployeeDevice::query()->create([
                'tenant_id' => $membership->tenant_id, 'membership_id' => $membership->id,
                'token_hash' => hash('sha256', $deviceToken), 'expires_at' => now()->addDays(90),
                'binding_type' => $mode, 'public_key' => $mode === 'android' ? $publicKey : null,
            ]);
            Audit::record($membership->tenant_id, $user->id, 'device.activated', 'device', $device->id);

            return ['user' => $user, 'device' => $device, 'token' => $deviceToken];
        });
    }
}
