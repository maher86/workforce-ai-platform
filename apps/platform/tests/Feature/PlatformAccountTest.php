<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class PlatformAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Queue::fake();
        Notification::fake();
    }

    private function platform(): User
    {
        $user = User::factory()->create();
        $user->forceFill(['platform_admin' => true, 'two_factor_secret' => encrypt('SYNTHETICSECRET'), 'two_factor_confirmed_at' => now()])->save();

        return $user;
    }

    public function test_company_signup_cannot_self_promote_or_create_another_company(): void
    {
        $this->post('/register', ['name' => 'Synthetic owner', 'company_name' => 'Synthetic company', 'email' => 'single@example.test', 'password' => 'password', 'password_confirmation' => 'password', 'platform_admin' => true, 'company_id' => 999])->assertRedirect('/dashboard');
        $owner = User::query()->where('email', 'single@example.test')->sole();
        $this->assertFalse($owner->platform_admin);
        $this->assertNotNull($owner->company_id);
        $owner->markEmailAsVerified();
        $this->actingAs($owner->fresh())->post('/tenants', ['name' => 'Second company'])->assertSessionHasErrors('name');
        $this->assertDatabaseCount('tenants', 1);
        $this->get('/platform')->assertForbidden();
    }

    public function test_account_cannot_be_invited_to_a_second_company_or_platform_account_into_any_company(): void
    {
        $service = app(ManageWorkforce::class);
        $first = User::factory()->create();
        $firstCompany = $service->createTenant($first, 'First synthetic company');
        $second = User::factory()->create();
        $secondCompany = $service->createTenant($second, 'Second synthetic company');
        $platform = $this->platform();
        $this->actingAs($second)->post('/tenants/'.$secondCompany->id.'/managers', ['email' => $first->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->post('/tenants/'.$secondCompany->id.'/managers', ['email' => $platform->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertDatabaseMissing('memberships', ['tenant_id' => $secondCompany->id, 'user_id' => $first->id]);
        $this->assertDatabaseMissing('memberships', ['user_id' => $platform->id]);
        $this->assertSame($firstCompany->id, $first->fresh()->company_id);
        Notification::assertNothingSent();
    }

    public function test_legacy_extra_company_is_not_listed_and_direct_identifiers_are_denied(): void
    {
        $service = app(ManageWorkforce::class);
        $owner = User::factory()->create();
        $first = $service->createTenant($owner, 'Selected synthetic company');
        $otherOwner = User::factory()->create();
        $other = $service->createTenant($otherOwner, 'Legacy synthetic company');
        Membership::query()->create(['tenant_id' => $other->id, 'user_id' => $owner->id, 'role' => 'owner']);
        $this->actingAs($owner)->get('/dashboard')->assertInertia(fn (Assert $page) => $page->has('workspaces', 1)->where('workspaces.0.id', $first->id));
        $this->get('/tenants/'.$other->id.'/team')->assertNotFound();
        $this->get('/tenants/'.$other->id.'/reports')->assertNotFound();
        $this->post('/tenants/'.$other->id.'/employees', ['name' => 'Forbidden'])->assertNotFound();
        $this->assertDatabaseHas('tenants', ['id' => $other->id]);
        $this->assertDatabaseCount('tenants', 2);
    }

    public function test_platform_needs_its_own_role_mfa_and_recent_password_and_never_becomes_customer(): void
    {
        $owner = User::factory()->create();
        $company = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic company');
        $admin = User::factory()->create();
        $admin->forceFill(['platform_admin' => true])->save();
        $this->actingAs($admin)->get('/platform')->assertRedirect('/settings/security');
        $admin->forceFill(['two_factor_secret' => encrypt('SYNTHETICSECRET'), 'two_factor_confirmed_at' => now()])->save();
        $this->actingAs($admin->fresh())->get('/platform')->assertRedirect(route('password.confirm'));
        $this->withSession(['auth.password_confirmed_at' => now()->subMinutes(11)->timestamp])->get('/platform')->assertRedirect(route('password.confirm'));
        $this->withSession(['auth.password_confirmed_at' => now()->timestamp])->get('/platform')->assertOk();
        $this->get('/tenants/'.$company->id.'/team')->assertRedirect('/platform');
        $this->get('/tenants/'.$company->id.'/reports')->assertForbidden();
        $this->assertSame($admin->id, auth()->id());
        $this->assertDatabaseMissing('memberships', ['user_id' => $admin->id]);
    }

    public function test_diagnostics_are_scoped_expiring_audited_and_do_not_expose_employee_evidence(): void
    {
        $service = app(ManageWorkforce::class);
        $owner = User::factory()->create();
        $company = $service->createTenant($owner, 'Synthetic company');
        $employee = $service->addEmployee($owner, $company->id, 'Synthetic private employee');
        $report = app(SubmitReport::class)->execute(User::query()->findOrFail($employee->user_id), $company->id, (string) Str::uuid(), 'Private synthetic evidence.', []);
        $report->update(['status' => 'failed', 'failure_code' => 'SYNTHETIC_FAILURE']);
        $otherOwner = User::factory()->create();
        $other = $service->createTenant($otherOwner, 'Foreign synthetic company');
        $admin = $this->platform();
        $this->actingAs($admin)->withSession(['auth.password_confirmed_at' => now()->timestamp])->post('/platform/companies/'.$company->id.'/diagnostics', ['reason' => 'Synthetic support ticket 123'])->assertRedirect();
        $grant = DB::table('platform_diagnostic_access')->sole();
        $this->assertNotSame('Synthetic support ticket 123', $grant->reason);
        $this->get('/platform/diagnostics/'.$grant->id)->assertOk()->assertInertia(fn (Assert $page) => $page->where('company.id', $company->id)->where('summary.failed', 1)->where('failures.0.id', $report->id)->missing('failures.0.source_text')->missing('failures.0.membership_id')->missing('media')->missing('employees'));
        $this->assertDatabaseHas('audit_entries', ['tenant_id' => $company->id, 'actor_id' => $admin->id, 'action' => 'platform.diagnostics_viewed']);
        $this->assertDatabaseMissing('audit_entries', ['tenant_id' => $other->id, 'actor_id' => $admin->id]);
        $this->actingAs($this->platform())->withSession(['auth.password_confirmed_at' => now()->timestamp])->get('/platform/diagnostics/'.$grant->id)->assertNotFound();
        $this->actingAs($owner)->get('/platform/diagnostics/'.$grant->id)->assertForbidden();
        DB::table('platform_diagnostic_access')->where('id', $grant->id)->update(['expires_at' => now()->subSecond()]);
        $this->actingAs($admin)->withSession(['auth.password_confirmed_at' => now()->timestamp])->get('/platform/diagnostics/'.$grant->id)->assertNotFound();
    }

    public function test_operator_command_never_promotes_an_existing_company_account(): void
    {
        $owner = User::factory()->create();
        app(ManageWorkforce::class)->createTenant($owner, 'Synthetic company');
        $this->artisan('platform:create-admin', ['email' => $owner->email])->assertExitCode(1);
        $this->assertFalse($owner->fresh()->platform_admin);
        $this->artisan('platform:create-admin', ['email' => 'platform@example.test'])->expectsQuestion('Password (12+ characters, upper/lowercase, number and symbol)', 'Synthetic!Password123')->expectsQuestion('Confirm password', 'Synthetic!Password123')->assertExitCode(0);
        $admin = User::query()->where('email', 'platform@example.test')->sole();
        $this->assertTrue($admin->platform_admin);
        $this->assertNull($admin->company_id);
        $this->assertNull($admin->email_verified_at);
        $this->assertDatabaseMissing('memberships', ['user_id' => $admin->id]);
    }

    public function test_legacy_binding_command_requires_existing_membership_expected_binding_and_apply(): void
    {
        $service = app(ManageWorkforce::class);
        $owner = User::factory()->create();
        $first = $service->createTenant($owner, 'Original synthetic company');
        $otherOwner = User::factory()->create();
        $other = $service->createTenant($otherOwner, 'Unrelated synthetic company');
        $this->artisan('company:bind-account', ['user' => $owner->id, 'tenant' => $other->id, '--expected-company' => $first->id, '--apply' => true])->assertExitCode(1);
        $this->assertSame($first->id, $owner->fresh()->company_id);
        Membership::query()->create(['tenant_id' => $other->id, 'user_id' => $owner->id, 'role' => 'owner']);
        $this->artisan('company:bind-account', ['user' => $owner->id, 'tenant' => $other->id, '--expected-company' => $first->id])->assertExitCode(0);
        $this->assertSame($first->id, $owner->fresh()->company_id);
        $this->artisan('company:bind-account', ['user' => $owner->id, 'tenant' => $other->id, '--expected-company' => 'none', '--apply' => true])->assertExitCode(1);
        $this->artisan('company:bind-account', ['user' => $owner->id, 'tenant' => $other->id, '--expected-company' => $first->id, '--apply' => true])->assertExitCode(0);
        $this->assertSame($other->id, $owner->fresh()->company_id);
        $this->assertDatabaseCount('tenants', 2);
        $this->assertDatabaseHas('memberships', ['user_id' => $owner->id, 'tenant_id' => $first->id, 'active' => true]);
    }
}
