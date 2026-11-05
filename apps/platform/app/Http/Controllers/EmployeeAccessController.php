<?php

namespace App\Http\Controllers;

use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeAccessController extends Controller
{
    public function activate(Request $request, EmployeeActivation $activation): RedirectResponse
    {
        // Never silently replace the manager's identity or another employee's device.
        abort_if($request->user() !== null, 409, 'Open this link on the employee phone or in a private browser window.');
        $data = $request->validate(['token' => ['required', 'string', 'size:64', 'alpha_num:ascii']]);
        $grant = $activation->consume($data['token']);
        Auth::login($grant['user']);
        $request->session()->regenerate();
        $request->session()->put('employee_device_id', $grant['device']->id);

        return redirect('/employee')->withCookie(cookie(
            'workforce_device', $grant['token'], 90 * 24 * 60, '/', null, $request->isSecure(), true, false, 'lax',
        ));
    }

    public function home(Request $request): Response
    {
        abort_unless($request->user()?->employee_only, 403);
        $device = EmployeeDevice::query()->findOrFail((int) $request->session()->get('employee_device_id'));
        $member = Membership::query()->where('tenant_id', $device->tenant_id)->where('user_id', $request->user()->id)
            ->where('active', true)->findOrFail($device->membership_id);

        return Inertia::render('employee/home', [
            'employeeName' => $request->user()->name,
            'tenantName' => Tenant::query()->findOrFail($member->tenant_id)->name,
        ]);
    }

    public function disconnect(Request $request): RedirectResponse
    {
        abort_unless($request->user()?->employee_only, 403);
        EmployeeDevice::query()->whereKey($request->session()->get('employee_device_id'))->update(['revoked_at' => now()]);
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Cookie::queue(Cookie::forget('workforce_device'));

        return redirect('/employee/connect');
    }
}
