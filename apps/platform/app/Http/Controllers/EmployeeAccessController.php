<?php

namespace App\Http\Controllers;

use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeContext;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportActivity;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeAccessController extends Controller
{
    public function activationPage(Request $request): Response
    {
        return Inertia::render('employee/activate', [
            'existingAccount' => $request->user() === null ? null : ($request->user()->employee_only ? 'employee' : 'manager'),
        ]);
    }

    public function activate(Request $request, EmployeeActivation $activation): RedirectResponse
    {
        // Never silently replace the manager's identity or another employee's device.
        if ($request->user() !== null) {
            return redirect('/employee/activate')->withErrors(['account' => 'يوجد حساب مفتوح في هذا المتصفح. افتح الحساب الحالي، أو اطلب مساعدة المدير لتفعيل موظف آخر.']);
        }
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
        $member = app(EmployeeContext::class)->resolve($request->user(), (int) $request->session()->get('employee_device_id'));

        return Inertia::render('employee/home', [
            'tenantName' => fn () => Tenant::query()->findOrFail($member->tenant_id)->name,
            'employeeName' => $member->display_name ?? $request->user()->name,
            'employeePhone' => $member->phone,
            'profilePhotoUrl' => $member->profile_photo_path ? '/employee/profile/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
            'profileSaved' => $request->session()->pull('profile_saved', false),
            'reports' => fn () => Report::query()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id)->latest('id')->limit(12)->get(['id', 'status', 'review_status', 'created_at']),
            'aiMode' => config('workforce.ai_provider'),
            'days' => fn () => app(ReportActivity::class)->days(Report::query()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id)),
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
