<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\Membership;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Symfony\Component\HttpFoundation\Response;

class EmployeeDeviceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        // Device credentials are encrypted HttpOnly cookies, never URL credentials.
        $token = $request->cookie('workforce_device');
        $device = is_string($token) ? EmployeeDevice::query()
            ->where('token_hash', hash('sha256', $token))->whereNull('revoked_at')
            ->where('expires_at', '>', now())->first() : null;
        $membership = $device ? Membership::query()->where('tenant_id', $device->tenant_id)
            ->where('active', true)->where('role', 'employee')->find($device->membership_id) : null;

        if (! $request->user() && $membership) {
            $user = User::query()->find($membership->user_id);
            if ($user?->employee_only) {
                Auth::login($user);
                $request->session()->regenerate();
                $request->session()->put('employee_device_id', $device->id);
            }
        }

        if ($request->user()?->employee_only) {
            if (! $device || ! $membership || $membership->user_id !== $request->user()->id
                || $request->session()->get('employee_device_id') !== $device->id) {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
                Cookie::queue(Cookie::forget('workforce_device'));

                return redirect('/employee/connect')->withHeaders(['Cache-Control' => 'no-store, private']);
            }
            // Employee identities cannot access manager auth/settings/recovery surfaces.
            if (! $request->is('employee', 'employee/*')) {
                return redirect('/employee')->withHeaders(['Cache-Control' => 'no-store, private']);
            }
        }

        if (! $request->user() && $request->is('employee')) {
            return redirect('/employee/connect')->withHeaders(['Cache-Control' => 'no-store, private']);
        }

        $response = $next($request);
        // Do not persist invitations or personal responses in HTTP/PWA caches.
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Referrer-Policy', 'no-referrer');

        return $response;
    }
}
