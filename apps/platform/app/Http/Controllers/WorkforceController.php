<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Identity\UpdateEmployeeProfile;
use App\Modules\Reporting\Report;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkforceController extends Controller
{
    public function index(Request $request, TenantAccess $access, ?int $tenant = null): Response
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);
        $memberships = Membership::query()->where('user_id', $actor->id)->where('active', true)->get();
        $managementMemberships = $memberships->filter(fn (Membership $member) => in_array($member->role, ['owner', 'manager'], true));
        $workspaces = Tenant::query()->whereIn('id', $managementMemberships->pluck('tenant_id'))->get(['id', 'name']);
        $selected = $tenant ?? $memberships->first(fn (Membership $member) => in_array($member->role, ['owner', 'manager'], true))?->tenant_id;
        if ($tenant === null && $selected !== null) {
            return app(ManagerOverviewController::class)->index($request, $selected);
        }
        $employees = [];
        $canManageManagers = false;
        if ($selected !== null) {
            $canManageManagers = $access->manageTeam($actor, $selected)->role === 'owner';
            $employees = Membership::query()->where('tenant_id', $selected)->where('role', 'employee')->select('memberships.*')
                ->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')
                ->selectSub(EmployeeDevice::query()->selectRaw('COUNT(*)')->whereColumn('tenant_id', 'memberships.tenant_id')->whereColumn('membership_id', 'memberships.id')->whereNull('revoked_at')->where('expires_at', '>', now()), 'device_count')->orderBy('id')->get()
                ->map(fn (Membership $member) => [
                    'id' => $member->id, 'name' => $member->display_name ?? $member->getAttribute('account_name'),
                    'phone' => $member->phone,
                    'photoUrl' => $member->profile_photo_path ? '/tenants/'.$selected.'/employees/'.$member->id.'/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
                    'active' => $member->active,
                    'devices' => (int) $member->getAttribute('device_count'),
                ])->all();
        }

        $managers = $canManageManagers ? Membership::query()->where('tenant_id', $selected)->where('role', 'manager')->select('memberships.*')->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')->get()->map(fn (Membership $member) => [
            'id' => $member->id, 'name' => $member->getAttribute('account_name'), 'active' => $member->active,
        ])->all() : [];

        return Inertia::render('workforce/team', [
            'workspaces' => $workspaces, 'selectedTenant' => $selected, 'employees' => $employees,
            'activation' => $request->session()->pull('activation'),
            'canManageManagers' => $canManageManagers,
            'managers' => $managers,
            'managerAdded' => $request->session()->pull('manager_added', false),
            'managerName' => $actor->name,
            'summary' => $selected === null ? null : [
                'employees' => count(array_filter($employees, fn ($member) => $member['active'])),
                'reports' => Report::query()->where('tenant_id', $selected)->count(),
                'processing' => Report::query()->where('tenant_id', $selected)->whereIn('status', ['submitted', 'processing'])->count(),
            ],
        ]);
    }

    public function createTenant(Request $request, ManageWorkforce $workforce): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $tenant = $workforce->createTenant($request->user(), $data['name']);

        return redirect('/tenants/'.$tenant->id.'/team');
    }

    public function addEmployee(Request $request, int $tenant, ManageWorkforce $workforce, EmployeeActivation $activation, UpdateEmployeeProfile $profile): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'phone' => ['nullable', 'regex:/^\+[1-9][0-9]{6,14}$/']]);
        $employee = $workforce->addEmployee($request->user(), $tenant, $data['name']);
        $profile->execute($request->user(), $tenant, $employee->id, ['phone' => $data['phone'] ?? null]);
        $token = $activation->issue($request->user(), $tenant, $employee->id);

        return $this->showActivation($tenant, $data['name'], $token);
    }

    public function invite(Request $request, int $tenant, int $membership, EmployeeActivation $activation, TenantAccess $access): RedirectResponse
    {
        $employee = $access->employee($request->user(), $tenant, $membership);
        $token = $activation->issue($request->user(), $tenant, $membership);

        return $this->showActivation($tenant, $employee->display_name ?? User::query()->findOrFail($employee->user_id)->name, $token);
    }

    public function revoke(Request $request, int $tenant, int $membership, ManageWorkforce $workforce): RedirectResponse
    {
        $workforce->revokeAccess($request->user(), $tenant, $membership, $request->boolean('disable'));

        return redirect('/tenants/'.$tenant.'/team');
    }

    public function enable(Request $request, int $tenant, int $membership, ManageWorkforce $workforce, EmployeeActivation $activation): RedirectResponse
    {
        $employee = $workforce->restoreAccess($request->user(), $tenant, $membership);
        $token = $activation->issue($request->user(), $tenant, $membership);

        return $this->showActivation($tenant, $employee->display_name ?? User::query()->findOrFail($employee->user_id)->name, $token);
    }

    public function addManager(Request $request, int $tenant, ManageWorkforce $workforce): RedirectResponse
    {
        $data = $request->validate(['email' => 'required|email|max:254', 'password' => 'required|current_password']);
        $workforce->addManager($request->user(), $tenant, $data['email']);

        return back()->with('manager_added', true);
    }

    public function removeManager(Request $request, int $tenant, int $membership, ManageWorkforce $workforce): RedirectResponse
    {
        $request->validate(['password' => 'required|current_password']);
        $workforce->removeManager($request->user(), $tenant, $membership);

        return back();
    }

    private function showActivation(int $tenant, string $name, string $token): RedirectResponse
    {
        $publicUrl = config('workforce.public_url');
        $activationUrl = is_string($publicUrl) && $publicUrl !== ''
            ? rtrim($publicUrl, '/').'/employee/activate'
            : url('/employee/activate');

        // Fragment stays on the device: HTTP access logs and referrers never receive it.
        return redirect('/tenants/'.$tenant.'/team')->with('activation', [
            'name' => $name, 'url' => $activationUrl.'#'.$token,
        ]);
    }
}
