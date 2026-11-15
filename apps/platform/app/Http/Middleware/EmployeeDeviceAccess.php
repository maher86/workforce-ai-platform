<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\Membership;
use App\Modules\Identity\VerifyDeviceRequest;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EmployeeDeviceAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->is('employee/device-clock')) {
            return $next($request)->withHeaders(['Cache-Control' => 'no-store, private']);
        }
        // Device credentials are encrypted HttpOnly cookies, never URL credentials.
        $token = $request->cookie('workforce_device');
        $device = is_string($token) ? EmployeeDevice::query()
            ->where('token_hash', hash('sha256', $token))->whereNull('revoked_at')
            ->where('expires_at', '>', now())->first() : null;
        $membership = $device ? Membership::query()->where('tenant_id', $device->tenant_id)
            ->where('active', true)->where('role', 'employee')->find($device->membership_id) : null;

        // Proof is checked BEFORE session restoration or any personal response, including files.
        if ($device && $membership && $device->binding_type === 'android' && $request->is('employee', 'employee/*')) {
            $valid = app(VerifyDeviceRequest::class)->execute($device, $request->getRealMethod(), $request->getRequestUri(),
                (string) $request->header('X-Workforce-Time', ''), (string) $request->header('X-Workforce-Nonce', ''), (string) $request->header('X-Workforce-Proof', ''));
            if (! $valid) {
                return response()->json(['message' => 'تعذر إثبات الجهاز المعتمد. افتح الحساب من التطبيق المعتمد أو اطلب نقل الحساب من المدير. [DEVICE-PROOF]', 'code' => 'DEVICE_PROOF_REQUIRED'], 401)->withHeaders(['Cache-Control' => 'no-store, private']);
            }
        }

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
        if ($device?->binding_type === 'android' && $response->isRedirect()) {
            $location = (string) $response->headers->get('Location', '/employee');
            $parts = parse_url($location);
            $path = is_array($parts) ? ($parts['path'] ?? '') : '';
            if (! is_array($parts) || isset($parts['user']) || (isset($parts['scheme']) && $parts['scheme'] !== $request->getScheme()) || (isset($parts['host']) && strtolower($parts['host']) !== strtolower($request->getHost()))
                || ! ($path === '/employee' || str_starts_with($path, '/employee/'))) {
                $location = '/employee';
            }
            $cookies = $response->headers->getCookies();
            if ($request->header('X-Inertia')) {
                $response = Inertia::location($location);
            } elseif ($request->isMethod('GET')) {
                $target = json_encode($location, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
                $response = response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.location.replace('.$target.')</script>');
            } else {
                $response = response()->json(['redirect' => $location]);
            }
            foreach ($cookies as $cookie) {
                $response->headers->setCookie($cookie);
            }
        }
        // Do not persist invitations or personal responses in HTTP/PWA caches.
        $response->headers->set('Cache-Control', 'no-store, private');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $response;
    }
}
