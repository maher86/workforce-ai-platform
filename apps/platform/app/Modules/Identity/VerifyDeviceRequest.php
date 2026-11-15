<?php

namespace App\Modules\Identity;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class VerifyDeviceRequest
{
    public function execute(EmployeeDevice $device, string $method, string $target, string $timestamp, string $nonce, string $signature): bool
    {
        if (! preg_match('/^[0-9]{10}$/D', $timestamp) || abs((int) now()->timestamp - (int) $timestamp) > 600
            || ! preg_match('/^[a-f0-9]{32}$/D', $nonce) || ! is_string($device->public_key)
            || ! DeviceKey::verify($device->public_key, DeviceKey::requestMessage($method, $target, $timestamp, $nonce), $signature)) {
            return false;
        }

        // Atomic, durable replay rejection; database failure is never an auth bypass.
        return DB::table('employee_device_proofs')->insertOrIgnore([
            'tenant_id' => $device->tenant_id, 'device_id' => $device->id,
            'nonce_hash' => hash('sha256', $nonce),
            'expires_at' => Carbon::createFromTimestamp((int) $timestamp + 601),
        ]) === 1;
    }
}
