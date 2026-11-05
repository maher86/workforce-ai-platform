<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
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
        $workspaces = Tenant::query()->whereIn('id', $memberships->pluck('tenant_id'))->get(['id', 'name']);
        $selected = $tenant ?? $memberships->first()?->tenant_id;
        $employees = [];
        $canManageManagers = false;
        if ($selected !== null) {
            $canManageManagers = $access->manageTeam($actor, $selected)->role === 'owner';
            $employees = Membership::query()->where('tenant_id', $selected)->where('role', 'employee')->get()
                ->map(fn (Membership $member) => [
                    'id' => $member->id, 'name' => User::query()->findOrFail($member->user_id)->name,
                    'active' => $member->active,
                    'devices' => EmployeeDevice::query()->where('tenant_id', $selected)->where('membership_id', $member->id)
                        ->whereNull('revoked_at')->where('expires_at', '>', now())->count(),
                ])->all();
        }

        $managers = $canManageManagers ? Membership::query()->where('tenant_id', $selected)->where('role', 'manager')->get()->map(fn (Membership $member) => [
            'id' => $member->id, 'name' => User::query()->findOrFail($member->user_id)->name, 'active' => $member->active,
        ])->all() : [];

        return Inertia::render('workforce/team', [
            'workspaces' => $workspaces, 'selectedTenant' => $selected, 'employees' => $employees,
            'activation' => $request->session()->pull('activation'),
            'canManageManagers' => $canManageManagers,
            'managers' => $managers,
            'managerAdded' => $request->session()->pull('manager_added', false),
        ]);
    }

    public function createTenant(Request $request, ManageWorkforce $workforce): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $tenant = $workforce->createTenant($request->user(), $data['name']);

        return redirect('/tenants/'.$tenant->id.'/team');
    }

    public function addEmployee(Request $request, int $tenant, ManageWorkforce $workforce, EmployeeActivation $activation): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $employee = $workforce->addEmployee($request->user(), $tenant, $data['name']);
        $token = $activation->issue($request->user(), $tenant, $employee->id);

        return $this->showActivation($tenant, $data['name'], $token);
    }

    public function invite(Request $request, int $tenant, int $membership, EmployeeActivation $activation, TenantAccess $access): RedirectResponse
    {
        $employee = $access->employee($request->user(), $tenant, $membership);
        $token = $activation->issue($request->user(), $tenant, $membership);

        return $this->showActivation($tenant, User::query()->findOrFail($employee->user_id)->name, $token);
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

        return $this->showActivation($tenant, User::query()->findOrFail($employee->user_id)->name, $token);
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
