<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerGovernanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_add_and_revoke_verified_manager_with_password_confirmation(): void
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Governance test');
        $manager = User::factory()->create();
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/managers', ['email' => $manager->email, 'password' => 'wrong'])->assertSessionHasErrors('password');
        $this->post('/tenants/'.$tenant->id.'/managers', ['email' => $manager->email, 'password' => 'password'])->assertRedirect();
        $member = Membership::query()->where('tenant_id', $tenant->id)->where('user_id', $manager->id)->sole();
        $this->assertSame('manager', $member->role);
        $this->post('/tenants/'.$tenant->id.'/managers/'.$member->id.'/disable', ['password' => 'password'])->assertRedirect();
        $this->actingAs($manager)->get('/tenants/'.$tenant->id.'/team')->assertNotFound();
    }

    public function test_manager_cannot_grant_roles_and_employee_cannot_be_promoted_by_email(): void
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Governance test');
        $manager = User::factory()->create();
        app(ManageWorkforce::class)->addManager($owner, $tenant->id, $manager->email);
        $candidate = User::factory()->create();
        $this->actingAs($manager)->post('/tenants/'.$tenant->id.'/managers', ['email' => $candidate->email, 'password' => 'password'])->assertForbidden();
        $employee = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $identity = User::query()->findOrFail($employee->user_id);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/managers', ['email' => $identity->email, 'password' => 'password'])->assertNotFound();
        $this->assertSame('employee', $employee->fresh()->role);
    }

    public function test_reactivation_needs_new_device_and_cannot_cross_tenants(): void
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Governance test');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $activation = app(EmployeeActivation::class);
        $grant = $activation->consume($activation->issue($owner, $tenant->id, $member->id));
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $member->id, true);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees/'.$member->id.'/enable')->assertRedirect()->assertSessionHas('activation.url');
        $this->assertTrue($member->fresh()->active);
        $this->assertNotNull($grant['device']->fresh()->revoked_at);
        $foreign = Tenant::query()->create(['name' => 'Foreign']);
        $this->post('/tenants/'.$foreign->id.'/employees/'.$member->id.'/enable')->assertNotFound();
        $this->assertDatabaseCount('employee_devices', 1);
    }

    public function test_owner_cannot_delete_account_and_orphan_workspace(): void
    {
        $owner = User::factory()->create();
        app(ManageWorkforce::class)->createTenant($owner, 'Governance test');
        $this->actingAs($owner)->delete('/settings/profile', ['password' => 'password'])->assertSessionHasErrors('password');
        $this->assertDatabaseHas('users', ['id' => $owner->id]);
        $this->assertDatabaseCount('tenants', 1);
    }
}
