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
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class WorkforceController extends Controller
{
    public function index(Request $request, TenantAccess $access, ?int $tenant = null): Response|RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);
        if ($actor->platform_admin) {
            return redirect('/platform');
        }
        $company = $access->managementTenant($actor);
        $workspaces = Tenant::query()->where('id', $company)->get(['id', 'name']);
        $selected = $tenant ?? $company;
        if ($tenant === null && $selected !== null) {
            return app(ManagerOverviewController::class)->index($request, $selected);
        }
        $employees = [];
        $employeePages = null;
        $activeEmployees = 0;
        $filters = $request->validate(['search' => ['nullable', 'string', 'max:120'], 'page' => ['sometimes', 'integer', 'min:1', 'max:100000']]);
        $search = trim($filters['search'] ?? '');
        $canManageManagers = false;
        if ($selected !== null) {
            $canManageManagers = $access->manageTeam($actor, $selected)->role === 'owner';
            $roster = Membership::query()->where('tenant_id', $selected)->where('role', 'employee');
            $activeEmployees = (clone $roster)->where('active', true)->count();
            // Parameter binding prevents SQL injection; escape LIKE wildcards for literal search.
            $pattern = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($search)).'%';
            $page = $roster->select('memberships.*')
                ->when($search !== '', fn ($query) => $query->where(function ($query) use ($pattern): void {
                    $query->whereRaw('LOWER(COALESCE(display_name, (SELECT name FROM users WHERE users.id = memberships.user_id))) LIKE ?', [$pattern])
                        ->orWhereRaw('phone LIKE ?', [$pattern]);
                }))
                ->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')
                ->selectSub(EmployeeDevice::query()->selectRaw('COUNT(*)')->whereColumn('tenant_id', 'memberships.tenant_id')->whereColumn('membership_id', 'memberships.id')->whereNull('revoked_at')->where('expires_at', '>', now()), 'device_count')
                ->selectSub(EmployeeDevice::query()->select('id')->whereColumn('tenant_id', 'memberships.tenant_id')->whereColumn('membership_id', 'memberships.id')->whereNull('revoked_at')->where('expires_at', '>', now())->limit(1), 'approved_device_id')->orderBy('id')->paginate(24)->appends(['search' => $search]);
            $employees = $page->getCollection()->map(fn (Membership $member) => [
                'id' => $member->id, 'name' => $member->display_name ?? $member->getAttribute('account_name'),
                'phone' => $member->phone,
                'photoUrl' => $member->profile_photo_path ? '/tenants/'.$selected.'/employees/'.$member->id.'/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
                'active' => $member->active,
                'devices' => (int) $member->getAttribute('device_count'),
                'deviceId' => $member->getAttribute('approved_device_id'),
            ])->all();
            $employeePages = ['total' => $page->total(), 'from' => $page->firstItem(), 'to' => $page->lastItem(), 'previous' => $page->previousPageUrl(), 'next' => $page->nextPageUrl()];
        }

        $managers = $canManageManagers ? Membership::query()->where('tenant_id', $selected)->where('role', 'manager')->select('memberships.*')->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')->get()->map(fn (Membership $member) => [
            'id' => $member->id, 'name' => $member->getAttribute('account_name'), 'active' => $member->active,
        ])->all() : [];

        return Inertia::render('workforce/team', [
            'workspaces' => $workspaces, 'selectedTenant' => $selected, 'employees' => $employees,
            'employeePages' => $employeePages, 'search' => $search,
            'activation' => $request->session()->pull('activation'),
            'canManageManagers' => $canManageManagers,
            'managers' => $managers,
            'managerAdded' => $request->session()->pull('manager_added', false),
            'managerName' => $actor->name,
            'androidDownloadUrl' => rtrim((string) (config('workforce.public_url') ?: url('/')), '/').'/downloads/',
            'summary' => $selected === null ? null : [
                'employees' => $activeEmployees,
            ],
        ]);
    }

    public function createTenant(Request $request, ManageWorkforce $workforce): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $tenant = $workforce->createTenant($request->user(), $data['name'], 'general');

        return redirect('/tenants/'.$tenant->id.'/team');
    }

    public function addEmployee(Request $request, int $tenant, ManageWorkforce $workforce, EmployeeActivation $activation, UpdateEmployeeProfile $profile): RedirectResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'phone' => ['nullable', 'regex:/^\+[1-9][0-9]{6,14}$/'], 'device_mode' => 'sometimes|in:android,browser']);
        $employee = $workforce->addEmployee($request->user(), $tenant, $data['name']);
        $profile->execute($request->user(), $tenant, $employee->id, ['phone' => $data['phone'] ?? null]);
        $token = $activation->issue($request->user(), $tenant, $employee->id, $data['device_mode'] ?? 'browser');

        return $this->showActivation($tenant, $data['name'], $token, $data['device_mode'] ?? 'browser');
    }

    public function invite(Request $request, int $tenant, int $membership, EmployeeActivation $activation, TenantAccess $access): RedirectResponse
    {
        $employee = $access->employee($request->user(), $tenant, $membership);
        try {
            $data = $request->validate(['device_mode' => 'sometimes|in:android,browser']);
            $token = $activation->issue($request->user(), $tenant, $membership, $data['device_mode'] ?? 'browser');
        } catch (ValidationException $exception) {
            throw $exception->redirectTo('/tenants/'.$tenant.'/team');
        }

        return $this->showActivation($tenant, $employee->display_name ?? User::query()->findOrFail($employee->user_id)->name, $token, $data['device_mode'] ?? 'browser');
    }

    public function revoke(Request $request, int $tenant, int $membership, ManageWorkforce $workforce): RedirectResponse
    {
        $workforce->revokeAccess($request->user(), $tenant, $membership, $request->boolean('disable'));

        return redirect('/tenants/'.$tenant.'/team');
    }

    public function transfer(Request $request, int $tenant, int $membership, EmployeeActivation $activation, TenantAccess $access): RedirectResponse
    {
        $employee = $access->employee($request->user(), $tenant, $membership);
        try {
            $data = $request->validate(['confirmed' => 'required|accepted', 'expected_device_id' => 'required|integer|min:1', 'device_mode' => 'required|in:android,browser']);
            $token = $activation->transfer($request->user(), $tenant, $membership, $data['expected_device_id'], $data['device_mode']);
        } catch (ValidationException $exception) {
            throw $exception->redirectTo('/tenants/'.$tenant.'/team');
        }

        return $this->showActivation($tenant, $employee->display_name ?? User::query()->findOrFail($employee->user_id)->name, $token, $data['device_mode']);
    }

    public function enable(Request $request, int $tenant, int $membership, ManageWorkforce $workforce, EmployeeActivation $activation): RedirectResponse
    {
        $data = $request->validate(['device_mode' => 'sometimes|in:android,browser']);
        $employee = $workforce->restoreAccess($request->user(), $tenant, $membership);
        $token = $activation->issue($request->user(), $tenant, $membership, $data['device_mode'] ?? 'browser');

        return $this->showActivation($tenant, $employee->display_name ?? User::query()->findOrFail($employee->user_id)->name, $token, $data['device_mode'] ?? 'browser');
    }

    public function addManager(Request $request, int $tenant, ManageWorkforce $workforce): RedirectResponse
    {
        $data = $request->validate(['name' => 'nullable|string|max:120', 'email' => 'required|email|max:254', 'password' => 'required|current_password']);
        $workforce->addManager($request->user(), $tenant, $data['email'], $data['name'] ?? null);

        return back()->with('manager_added', true);
    }

    public function removeManager(Request $request, int $tenant, int $membership, ManageWorkforce $workforce): RedirectResponse
    {
        $request->validate(['password' => 'required|current_password']);
        $workforce->removeManager($request->user(), $tenant, $membership);

        return back();
    }

    private function showActivation(int $tenant, string $name, string $token, string $deviceMode = 'browser'): RedirectResponse
    {
        $publicUrl = config('workforce.public_url');
        $activationUrl = is_string($publicUrl) && $publicUrl !== ''
            ? rtrim($publicUrl, '/').'/employee/activate'
            : url('/employee/activate');

        // Fragment stays on the device: HTTP access logs and referrers never receive it.
        return redirect('/tenants/'.$tenant.'/team')->with('activation', [
            'name' => $name, 'url' => $activationUrl.'#'.$token, 'deviceMode' => $deviceMode,
        ]);
    }
}
