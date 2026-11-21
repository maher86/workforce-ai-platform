<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeInvitation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\SubmitReport;
use App\Notifications\CompanyAdministratorAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CompanyOnboardingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Notification::fake();
        Queue::fake();
    }

    public function test_signup_creates_only_the_new_company_and_its_owner_and_requires_email_verification(): void
    {
        config(['workforce.reporting_domain' => 'automotive']);
        $foreignOwner = User::factory()->create();
        $foreign = app(ManageWorkforce::class)->createTenant($foreignOwner, 'Existing synthetic company');
        $this->post('/register', ['company_name' => 'New synthetic company', 'name' => 'Synthetic owner', 'email' => 'owner@example.test', 'password' => 'password', 'password_confirmation' => 'password', 'tenant_id' => $foreign->id, 'role' => 'manager'])->assertRedirect('/dashboard');
        $owner = User::query()->where('email', 'owner@example.test')->sole();
        $tenant = Tenant::query()->where('name', 'New synthetic company')->sole();
        $this->assertDatabaseHas('memberships', ['tenant_id' => $tenant->id, 'user_id' => $owner->id, 'role' => 'owner', 'active' => true]);
        $this->assertDatabaseMissing('memberships', ['tenant_id' => $foreign->id, 'user_id' => $owner->id]);
        $this->assertSame('general', $tenant->reporting_domain);
        $this->assertNull($owner->email_verified_at);
        $this->get('/dashboard')->assertRedirect(route('verification.notice'));
        $owner->markEmailAsVerified();
        $this->actingAs($owner->fresh())->get('/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->component('reports/index')->where('tenant.id', $tenant->id)->has('workspaces', 1)->where('range', 'today'));
        $this->get('/tenants/'.$foreign->id.'/team')->assertNotFound();
    }

    public function test_invalid_company_registration_leaves_no_partial_account(): void
    {
        $this->post('/register', ['company_name' => '', 'name' => 'Synthetic owner', 'email' => 'invalid@example.test', 'password' => 'password', 'password_confirmation' => 'password'])->assertSessionHasErrors('company_name');
        $this->assertDatabaseMissing('users', ['email' => 'invalid@example.test']);
        $this->assertDatabaseCount('tenants', 0);
        $this->assertDatabaseCount('memberships', 0);
    }

    public function test_owner_can_provision_an_administrator_without_another_company_or_employee_qr(): void
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic company');
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/managers', ['name' => 'Invited administrator', 'email' => 'admin@example.test', 'password' => 'password'])->assertSessionHasNoErrors()->assertRedirect();
        $admin = User::query()->where('email', 'admin@example.test')->sole();
        $this->assertFalse($admin->employee_only);
        $this->assertNull($admin->email_verified_at);
        $this->assertDatabaseHas('memberships', ['tenant_id' => $tenant->id, 'user_id' => $admin->id, 'role' => 'manager']);
        $this->assertDatabaseCount('tenants', 1);
        $this->assertDatabaseCount('employee_invitations', 0);
        Notification::assertSentTo($admin, CompanyAdministratorAccess::class, function (CompanyAdministratorAccess $notice) use ($admin) {
            $this->assertNotNull($notice->token);
            auth()->logout();
            $this->post(route('password.update'), ['token' => $notice->token, 'email' => $admin->email, 'password' => 'newpassword123', 'password_confirmation' => 'newpassword123'])->assertSessionHasNoErrors()->assertRedirect(route('login'));
            $this->assertTrue(Hash::check('newpassword123', $admin->fresh()->password));
            $this->post(route('password.update'), ['token' => $notice->token, 'email' => $admin->email, 'password' => 'differentpassword123', 'password_confirmation' => 'differentpassword123'])->assertSessionHasErrors('email');

            return true;
        });
        $this->actingAs($admin)->get('/tenants/'.$tenant->id.'/team')->assertRedirect(route('verification.notice'));
        $admin->markEmailAsVerified();
        $this->actingAs($admin->fresh())->get('/tenants/'.$tenant->id.'/team')->assertOk()->assertInertia(fn (Assert $page) => $page->where('canManageManagers', false)->has('managers', 0));
    }

    public function test_roles_are_per_company_and_foreign_team_reports_qr_and_role_mutations_are_denied(): void
    {
        $access = app(ManageWorkforce::class);
        $actor = User::factory()->create();
        $own = $access->createTenant($actor, 'Own synthetic company');
        $otherOwner = User::factory()->create();
        $other = $access->createTenant($otherOwner, 'Other synthetic company');
        $access->addManager($otherOwner, $other->id, $actor->email);
        $ownPerson = $access->addEmployee($actor, $own->id, 'Own employee');
        $otherPerson = $access->addEmployee($otherOwner, $other->id, 'Other employee');
        $report = app(SubmitReport::class)->execute(User::query()->findOrFail($otherPerson->user_id), $other->id, (string) Str::uuid(), 'Synthetic work note.', []);
        $this->actingAs($actor)->get('/tenants/'.$own->id.'/team')->assertInertia(fn (Assert $page) => $page->where('canManageManagers', true)->has('employees', 1)->where('employees.0.id', $ownPerson->id));
        $this->get('/tenants/'.$other->id.'/team')->assertInertia(fn (Assert $page) => $page->where('canManageManagers', false)->has('employees', 1));
        $this->post('/tenants/'.$other->id.'/managers', ['email' => 'unauthorized@example.test', 'password' => 'password'])->assertForbidden();
        $foreignManager = Membership::query()->where('tenant_id', $other->id)->where('user_id', $actor->id)->sole();
        $this->post('/tenants/'.$own->id.'/managers/'.$foreignManager->id.'/disable', ['password' => 'password'])->assertNotFound();
        $this->assertTrue($foreignManager->fresh()->active);
        $this->post('/tenants/'.$own->id.'/employees/'.$otherPerson->id.'/invite', ['device_mode' => 'android'])->assertNotFound();
        $this->post('/tenants/'.$own->id.'/employees/'.$otherPerson->id.'/revoke', ['disable' => true])->assertNotFound();
        $this->get('/tenants/'.$own->id.'/reports/'.$report->id)->assertNotFound();
        $this->get('/tenants/'.$own->id.'/reports?employee='.$otherPerson->id)->assertNotFound();
        $this->assertDatabaseMissing('users', ['email' => 'unauthorized@example.test']);
        $this->assertTrue($otherPerson->fresh()->active);
    }

    public function test_add_employee_returns_android_activation_for_only_the_authorized_company(): void
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic company');
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees', ['name' => 'Synthetic employee', 'phone' => '+971501234567', 'device_mode' => 'android'])->assertSessionHasNoErrors()->assertRedirect('/tenants/'.$tenant->id.'/team')->assertSessionHas('activation.deviceMode', 'android');
        $person = Membership::query()->where('tenant_id', $tenant->id)->where('role', 'employee')->sole();
        $this->assertSame('+971501234567', $person->phone);
        $this->assertSame('android', EmployeeInvitation::query()->where('tenant_id', $tenant->id)->where('membership_id', $person->id)->sole()->device_mode);
        $this->get('/tenants/'.$tenant->id.'/team')->assertOk()->assertInertia(fn (Assert $page) => $page->where('selectedTenant', $tenant->id)->has('androidDownloadUrl')->has('employees', 1));
    }

    public function test_vehicle_routes_are_retired_without_deleting_report_history(): void
    {
        $owner = User::factory()->create();
        $workforce = app(ManageWorkforce::class);
        $tenant = $workforce->createTenant($owner, 'Synthetic company');
        $person = $workforce->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $report = app(SubmitReport::class)->execute(User::query()->findOrFail($person->user_id), $tenant->id, (string) Str::uuid(), 'Original synthetic text.', []);
        // A pre-existing association must not break access to historical evidence.
        $legacyId = DB::table('vehicles')->insertGetId(['tenant_id' => $tenant->id, 'plate' => 'LEGACY SYNTHETIC', 'plate_key' => 'LEGACYSYNTHETIC', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('reports')->where('id', $report->id)->update(['vehicle_id' => $legacyId]);
        $hash = $report->content_hash;
        $base = '/tenants/'.$tenant->id;
        $this->actingAs($owner)->get($base.'/vehicles')->assertNotFound();
        $this->get($base.'/vehicles/1')->assertNotFound();
        $this->post($base.'/reports/'.$report->id.'/vehicle', ['vehicle_plate' => 'OLD TEST'])->assertNotFound();
        $this->get($base.'/reports/'.$report->id)->assertOk()->assertInertia(fn (Assert $page) => $page->missing('vehicle')->missing('report.vehicle_id')->where('report.source_text', 'Original synthetic text.'));
        $this->assertSame($hash, $report->fresh()->content_hash);
        $this->assertDatabaseCount('reports', 1);
        $this->assertDatabaseHas('reports', ['id' => $report->id, 'vehicle_id' => $legacyId]);
    }
}
