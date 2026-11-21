<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PlatformAdministrator
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        abort_unless($user?->platform_admin && ! $user->employee_only && $user->company_id === null, 403);
        if (! $user->hasEnabledTwoFactorAuthentication()) {
            return redirect('/settings/security');
        }

        return $next($request);
    }
}
