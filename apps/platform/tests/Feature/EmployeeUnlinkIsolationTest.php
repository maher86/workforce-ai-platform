<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeInvitation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Reporting\Report;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EmployeeUnlinkIsolationTest extends TestCase
{
    use RefreshDatabase;

    public static function revocationModes(): array
    {
        return ['unlink phone' => [false], 'end employment access' => [true]];
    }

    #[DataProvider('revocationModes')]
    public function test_revoking_one_employee_preserves_other_employees_devices_access_and_reports(bool $disable): void
    {
        $workforce = app(ManageWorkforce::class);
        $activation = app(EmployeeActivation::class);
        $owner = User::factory()->create();
        $company = $workforce->createTenant($owner, 'Synthetic company');
        $target = $workforce->addEmployee($owner, $company->id, 'Target employee');
        $coworker = $workforce->addEmployee($owner, $company->id, 'Unaffected coworker');
        $foreignOwner = User::factory()->create();
        $foreignCompany = $workforce->createTenant($foreignOwner, 'Other synthetic company');
        $foreign = $workforce->addEmployee($foreignOwner, $foreignCompany->id, 'Unaffected foreign employee');

        $grants = [];
        foreach ([[$owner, $target], [$owner, $coworker], [$foreignOwner, $foreign]] as [$actor, $member]) {
            $grants[] = $activation->consume($activation->issue($actor, $member->tenant_id, $member->id));
            Report::query()->create([
                'tenant_id' => $member->tenant_id, 'membership_id' => $member->id,
                'submission_key' => (string) Str::uuid(), 'content_hash' => str_repeat('a', 64),
                'source_text' => 'Synthetic retained report',
            ]);
        }
        $reports = Report::withTrashed()->orderBy('id')->get()->toArray();
        $coworkerDevice = $grants[1]['device']->fresh()->getAttributes();
        $foreignDevice = $grants[2]['device']->fresh()->getAttributes();
        $otherInvitations = EmployeeInvitation::query()->whereIn('membership_id', [$coworker->id, $foreign->id])->orderBy('id')->get()->toArray();

        // Neither a forged employee ID nor a foreign tenant route grants access.
        $this->actingAs($owner)->post("/tenants/{$company->id}/employees/{$foreign->id}/revoke", ['disable' => $disable])->assertNotFound();
        $this->post("/tenants/{$foreignCompany->id}/employees/{$foreign->id}/revoke", ['disable' => $disable])->assertNotFound();
        $this->assertNull($grants[0]['device']->fresh()->revoked_at);
        $this->post("/tenants/{$company->id}/employees/{$target->id}/revoke", ['disable' => $disable])->assertRedirect("/tenants/{$company->id}/team");

        $this->assertNotNull($grants[0]['device']->fresh()->revoked_at);
        $this->assertSame(! $disable, $target->fresh()->active);
        $this->assertTrue($coworker->fresh()->active);
        $this->assertTrue($foreign->fresh()->active);
        $this->assertSame($coworkerDevice, $grants[1]['device']->fresh()->getAttributes());
        $this->assertSame($foreignDevice, $grants[2]['device']->fresh()->getAttributes());
        $this->assertDatabaseMissing('employee_invitations', ['membership_id' => $target->id]);
        $this->assertSame($otherInvitations, EmployeeInvitation::query()->whereIn('membership_id', [$coworker->id, $foreign->id])->orderBy('id')->get()->toArray());
        $this->assertSame($reports, Report::withTrashed()->orderBy('id')->get()->toArray());

        Auth::logout();
        $this->flushSession();
        $this->withCookie('workforce_device', $grants[0]['token'])->get('/employee')->assertRedirect('/employee/connect');
        $this->assertGuest();
        foreach ([1 => 'Unaffected coworker', 2 => 'Unaffected foreign employee'] as $index => $name) {
            Auth::logout();
            $this->flushSession();
            $this->withCookie('workforce_device', $grants[$index]['token'])->get('/employee')->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component('employee/home')->where('employeeName', $name));
            $this->assertAuthenticatedAs($grants[$index]['user']);
        }
    }
}
