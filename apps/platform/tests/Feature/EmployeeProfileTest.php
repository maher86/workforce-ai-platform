<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\UpdateEmployeeProfile;
use App\Modules\Media\MediaInput;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class EmployeeProfileTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $files = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Storage::fake('reports');
        Queue::fake();
    }

    protected function tearDown(): void
    {
        foreach ($this->files as $file) {
            @unlink($file);
        }
        parent::tearDown();
    }

    /** @return array{User, Tenant, Membership} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic profile workspace');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic person');

        return [$owner, $tenant, $member];
    }

    private function photo(): UploadedFile
    {
        $path = sys_get_temp_dir().'/profile-'.Str::uuid().'.png';
        $this->files[] = $path;
        (new Process(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=640x640', '-frames:v', '1', '-threads', '1', '-y', $path]))->setTimeout(15)->mustRun();

        return new UploadedFile($path, 'synthetic.png', 'image/png', null, true);
    }

    /** @return array<string, string> */
    private function activate(User $owner, Tenant $tenant, Membership $member): array
    {
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $member->id));

        return ['workforce_device' => $grant['token']];
    }

    public function test_manager_adds_contact_and_dashboard_is_tenant_scoped(): void
    {
        [$owner, $tenant] = $this->workforce();
        [, $foreign] = $this->workforce();
        Report::query()->create(['tenant_id' => $foreign->id, 'membership_id' => Membership::query()->where('tenant_id', $foreign->id)->where('role', 'employee')->sole()->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64)]);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees', ['name' => 'New synthetic person', 'phone' => '+15550001111'])->assertRedirect();
        $this->get('/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->component('workforce/team')
            ->where('managerName', $owner->name)->where('summary.employees', 2)->where('summary.reports', 0)->where('employees.1.phone', '+15550001111'));
        $this->get('/tenants/'.$foreign->id.'/team')->assertNotFound();
        $this->post('/tenants/'.$tenant->id.'/employees', ['name' => 'Invalid phone', 'phone' => 'not-a-phone'])->assertSessionHasErrors('phone');
    }

    public function test_manager_edits_membership_details_without_mutating_another_tenant_identity(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        [, $foreign] = $this->workforce();
        $other = Membership::query()->create(['tenant_id' => $foreign->id, 'user_id' => $member->user_id, 'role' => 'employee', 'display_name' => 'Other workspace alias']);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees/'.$member->id.'/profile', ['name' => 'Updated local alias', 'phone' => '+15550001111'])->assertRedirect();
        $this->assertSame('Updated local alias', $member->fresh()->display_name);
        $this->assertSame('Other workspace alias', $other->fresh()->display_name);
        $this->assertSame('Synthetic person', User::query()->findOrFail($member->user_id)->name);
        $this->post('/tenants/'.$tenant->id.'/employees/'.$other->id.'/profile', ['name' => 'Intruder'])->assertNotFound();
    }

    public function test_employee_replaces_own_private_photo_and_spoofed_details_are_ignored(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        $this->withCookies($this->activate($owner, $tenant, $member))->get('/employee')->assertOk();
        $this->post('/employee/profile', ['photo' => $this->photo(), 'name' => 'Forged name', 'phone' => '+15550002222', 'tenant_id' => 99999])->assertRedirect();
        $path = $member->fresh()->profile_photo_path;
        $this->assertNotNull($path);
        $this->assertSame('Synthetic person', $member->fresh()->display_name);
        $this->assertNull($member->fresh()->phone);
        $this->assertStringStartsWith('profiles/'.$tenant->id.'/'.$member->id.'/', $path);
        $this->assertSame([512, 512], array_slice(getimagesize(Storage::disk('reports')->path($path)), 0, 2));
        $this->get('/employee/profile/photo')->assertOk()->assertHeader('Content-Type', 'image/jpeg')->assertHeader('Cache-Control', 'no-store, private')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->get('/storage/'.$path)->assertNotFound();
        $this->post('/employee/profile', ['photo' => $this->photo()])->assertRedirect();
        Storage::disk('reports')->assertMissing($path);
        $this->assertNotSame($path, $member->fresh()->profile_photo_path);
        $this->assertCount(1, Storage::disk('reports')->allFiles());
    }

    public function test_photo_downloads_and_mutations_reject_foreign_managers_and_coworkers(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        [$foreignOwner] = $this->workforce();
        $photo = $this->photo();
        app(UpdateEmployeeProfile::class)->execute($owner, $tenant->id, $member->id, [], new MediaInput($photo->getPathname(), 'image'));
        $this->actingAs($foreignOwner)->get('/tenants/'.$tenant->id.'/employees/'.$member->id.'/photo')->assertNotFound();
        $this->post('/tenants/'.$tenant->id.'/employees/'.$member->id.'/profile', ['name' => 'Intruder'])->assertNotFound();
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/employees/'.$member->id.'/photo')->assertOk();
        $coworker = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        $actor = User::query()->findOrFail($coworker->user_id);
        $this->expectException(HttpException::class);
        app(UpdateEmployeeProfile::class)->execute($actor, $tenant->id, $member->id, [], new MediaInput($photo->getPathname(), 'image'));
    }

    public function test_invalid_profile_media_and_inactive_device_are_rejected(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        $this->withCookies($this->activate($owner, $tenant, $member))->get('/employee')->assertOk();
        $this->post('/employee/profile', ['photo' => UploadedFile::fake()->createWithContent('bad.jpg', '<svg><script>alert(1)</script></svg>')])->assertSessionHasErrors('media');
        $this->post('/employee/profile', ['photo' => UploadedFile::fake()->create('large.jpg', 4097)])->assertSessionHasErrors('photo');
        $this->assertSame([], Storage::disk('reports')->allFiles());
        $member->update(['active' => false]);
        $this->get('/employee/profile/photo')->assertRedirect('/employee/connect');
    }

    public function test_orphan_pruning_preserves_active_profile_and_removes_only_old_unreferenced_profiles(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        $photo = $this->photo();
        app(UpdateEmployeeProfile::class)->execute($owner, $tenant->id, $member->id, [], new MediaInput($photo->getPathname(), 'image'));
        $active = $member->fresh()->profile_photo_path;
        $orphan = 'profiles/'.$tenant->id.'/'.$member->id.'/'.Str::uuid().'.jpg';
        Storage::disk('reports')->put($orphan, 'synthetic orphan');
        touch(Storage::disk('reports')->path($active), now()->subDays(2)->getTimestamp());
        touch(Storage::disk('reports')->path($orphan), now()->subDays(2)->getTimestamp());
        $this->artisan('reports:prune-orphans', ['--apply' => true])->assertSuccessful();
        Storage::disk('reports')->assertExists($active);
        Storage::disk('reports')->assertMissing($orphan);
    }

    public function test_shared_action_rejects_images_even_with_text_but_without_audio(): void
    {
        [, $tenant, $member] = $this->workforce();
        $actor = User::query()->findOrFail($member->user_id);
        $photo = $this->photo();
        foreach ([null, 'Some text cannot replace the recording for an image.'] as $text) {
            try {
                app(SubmitReport::class)->execute($actor, $tenant->id, (string) Str::uuid(), $text, [new MediaInput($photo->getPathname(), 'image')]);
                $this->fail('Image without audio accepted');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('report', $exception->errors());
            }
        }
        $this->assertDatabaseCount('reports', 0);
        $this->assertSame([], Storage::disk('reports')->allFiles());
    }

    public function test_employee_http_cannot_submit_an_image_without_audio(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        $this->withCookies($this->activate($owner, $tenant, $member))->get('/employee')->assertOk();
        $this->post('/employee/reports', ['submission_key' => (string) Str::uuid(), 'images' => [$this->photo()]], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('report');
        $this->assertDatabaseCount('reports', 0);
    }
}
