<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\EmployeeInvitation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EmployeeOnboardingTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{User, Tenant, Membership} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic team');
        $employee = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');

        return [$owner, $tenant, $employee];
    }

    public function test_manager_can_onboard_without_employee_email_or_password(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner)->post('/tenants', ['name' => 'Example workspace'])->assertRedirect();
        $tenant = Tenant::query()->sole();
        $this->post('/tenants/'.$tenant->id.'/employees', ['name' => 'Example person'])->assertRedirect()
            ->assertSessionHas('activation.url');
        $employee = Membership::query()->where('role', 'employee')->sole();
        $identity = User::query()->findOrFail($employee->user_id);
        $this->assertTrue($identity->employee_only);
        $this->assertNull($identity->email_verified_at);
        $this->assertStringEndsWith('@employees.invalid', $identity->email);
        $this->get('/tenants/'.$tenant->id.'/team')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertInertia(fn (Assert $page) => $page->component('workforce/team')->has('employees', 1));
    }

    public function test_foreign_tenant_and_forged_membership_cannot_be_read_or_mutated(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        [, $foreignTenant, $foreignEmployee] = $this->workforce();
        $this->actingAs($owner)->get('/tenants/'.$foreignTenant->id.'/team')->assertNotFound();
        $this->post('/tenants/'.$foreignTenant->id.'/employees', ['name' => 'Intruder'])->assertNotFound();
        foreach (['invite', 'revoke'] as $action) {
            $this->post('/tenants/'.$tenant->id.'/employees/'.$foreignEmployee->id.'/'.$action)->assertNotFound();
        }
        $this->assertTrue($foreignEmployee->fresh()->active);
        $this->post('/tenants/'.$tenant->id.'/employees/'.$employee->id.'/invite')->assertRedirect();
        $this->get('/tenants/'.$tenant->id.'/team')
            ->assertInertia(fn (Assert $page) => $page->has('employees', 1)->where('employees.0.id', $employee->id));
    }

    public function test_roles_are_membership_specific_and_inactive_memberships_are_denied(): void
    {
        [$owner, $tenant] = $this->workforce();
        [, $foreign] = $this->workforce();
        $member = Membership::query()->create(['tenant_id' => $foreign->id, 'user_id' => $owner->id, 'role' => 'employee']);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/team')->assertOk();
        $this->get('/tenants/'.$foreign->id.'/team')->assertForbidden();
        $member->update(['role' => 'manager']);
        $this->get('/tenants/'.$foreign->id.'/team')->assertOk();
        $member->update(['active' => false]);
        $this->get('/tenants/'.$foreign->id.'/team')->assertNotFound();
    }

    public function test_activation_get_is_harmless_and_token_is_single_use_and_hashed(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $token = app(EmployeeActivation::class)->issue($owner, $tenant->id, $employee->id);
        $invitation = EmployeeInvitation::query()->sole();
        $this->assertSame(hash('sha256', $token), $invitation->token_hash);
        $this->get('/employee/activate')->assertOk()->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertNull($invitation->fresh()->used_at);
        $this->post('/employee/activate', ['token' => $token])->assertRedirect('/employee')->assertCookie('workforce_device');
        $this->assertAuthenticatedAs(User::query()->findOrFail($employee->user_id));
        $this->assertNotNull($invitation->fresh()->used_at);
        $this->assertDatabaseCount('employee_devices', 1);
        Auth::logout();
        $this->post('/employee/activate', ['token' => $token])->assertSessionHasErrors('token');
        $this->assertDatabaseCount('employee_devices', 1);
    }

    public function test_expired_invalid_reissued_and_disabled_tokens_are_denied(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $old = $service->issue($owner, $tenant->id, $employee->id);
        $current = $service->issue($owner, $tenant->id, $employee->id);
        $this->post('/employee/activate', ['token' => $old])->assertSessionHasErrors('token');
        $this->post('/employee/activate', ['token' => str_repeat('a', 64)])->assertSessionHasErrors('token');
        $this->travel(31)->minutes();
        $this->post('/employee/activate', ['token' => $current])->assertSessionHasErrors('token');
        $this->travelBack();
        $current = $service->issue($owner, $tenant->id, $employee->id);
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $employee->id, true);
        $this->post('/employee/activate', ['token' => $current])->assertSessionHasErrors('token');
        $this->assertDatabaseCount('employee_devices', 0);
    }

    public function test_activation_post_requires_csrf_and_does_not_consume_token_on_failure(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $token = app(EmployeeActivation::class)->issue($owner, $tenant->id, $employee->id);
        // Enable the real CSRF check (Laravel skips it in the testing environment).
        // The database remains the already guarded workforce_testing connection.
        $this->app['env'] = 'local';
        $this->post('/employee/activate', ['token' => $token])->assertStatus(419);
        $this->assertNull(EmployeeInvitation::query()->sole()->used_at);
        $this->assertDatabaseCount('employee_devices', 0);
    }

    public function test_manager_session_is_never_replaced_by_a_scanned_link(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $token = app(EmployeeActivation::class)->issue($owner, $tenant->id, $employee->id);
        $this->actingAs($owner)->post('/employee/activate', ['token' => $token])->assertStatus(409);
        $this->assertAuthenticatedAs($owner);
        $this->assertNull(EmployeeInvitation::query()->sole()->used_at);
    }

    public function test_cookie_restores_employee_without_password_but_revocation_blocks_live_session(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $employee->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('employee/home')->where('employeeName', 'Synthetic employee')->where('tenantName', $tenant->name));
        $this->get('/dashboard')->assertRedirect('/employee');
        $this->post('/tenants', ['name' => 'Forbidden'])->assertRedirect('/employee');
        $this->get('/settings/security')->assertRedirect('/employee');
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $employee->id);
        $this->get('/employee')->assertRedirect('/employee/connect');
        $this->assertGuest();
        $this->assertNotNull($grant['device']->fresh()->revoked_at);
    }

    public function test_disabled_membership_blocks_existing_device_and_session(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $employee->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $employee->update(['active' => false]);
        $this->get('/employee')->assertRedirect('/employee/connect');
        $this->assertGuest();
    }

    public function test_device_expiry_or_missing_cookie_cannot_be_bypassed_by_a_session(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $employee->id));
        $this->actingAs($grant['user'])->withSession(['employee_device_id' => $grant['device']->id])->get('/employee')->assertRedirect('/employee/connect');
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $grant['device']->update(['expires_at' => now()->subSecond()]);
        $this->get('/employee')->assertRedirect('/employee/connect');
        $this->assertGuest();
    }

    public function test_employee_can_disconnect_and_cannot_restore_the_revoked_device(): void
    {
        [$owner, $tenant, $employee] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $employee->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->post('/employee/disconnect')->assertRedirect('/employee/connect')->assertCookieExpired('workforce_device');
        $this->assertGuest();
        $this->get('/employee')->assertRedirect('/employee/connect');
    }

    public function test_database_rejects_a_foreign_tenant_membership_association(): void
    {
        [, , $employee] = $this->workforce();
        [, $foreign] = $this->workforce();
        $this->expectException(QueryException::class);
        EmployeeDevice::query()->create([
            'tenant_id' => $foreign->id, 'membership_id' => $employee->id,
            'token_hash' => hash('sha256', 'synthetic'), 'expires_at' => now()->addDay(),
        ]);
    }

    public function test_duplicate_membership_and_owner_revoke_are_forbidden(): void
    {
        [$owner, $tenant] = $this->workforce();
        $ownerMembership = app(TenantAccess::class)->member($owner, $tenant->id);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees/'.$ownerMembership->id.'/revoke')->assertNotFound();
        $this->expectException(QueryException::class);
        Membership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $owner->id, 'role' => 'employee']);
    }
}
