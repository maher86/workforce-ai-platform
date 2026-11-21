<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ActivityInsightsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Queue::fake();
    }

    /** @return array{User, Tenant, Membership} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic activity workspace');
        $person = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');

        return [$owner, $tenant, $person];
    }

    private function report(Tenant $tenant, Membership $person): Report
    {
        return app(SubmitReport::class)->execute(User::query()->findOrFail($person->user_id), $tenant->id, (string) Str::uuid(), 'Synthetic work described, not verified complete.', []);
    }

    public function test_dubai_day_bounds_and_metrics_count_only_selected_period(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        foreach ([['2026-11-06 19:59:59', 'pending', 'ready'], ['2026-11-06 20:00:00', 'approved', 'ready'], ['2026-11-07 10:00:00', 'changes_requested', 'failed'], ['2026-11-07 19:59:59', 'pending', 'processing'], ['2026-11-07 20:00:00', 'approved', 'ready']] as [$date, $review, $status]) {
            $this->report($tenant, $person)->update(['created_at' => $date, 'review_status' => $review, 'status' => $status]);
        }
        $base = '/tenants/'.$tenant->id;
        $this->actingAs($owner)->get($base.'/insights?from=2026-11-07&to=2026-11-07&employee='.$person->id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('insights/index')->where('metrics.0.reports', 3)->where('metrics.0.days', 1)
                ->where('metrics.0.approvalRate', 50)->where('metrics.0.failed', 1)->where('metrics.0.processing', 1)->where('series.0.total', 3)->where('days.data.0.total', 3));
        $this->get($base.'/reports/by-day?day=2026-11-07')->assertOk()->assertJsonCount(3, 'data');
        $this->get($base.'/insights?from=2026-11-08&to=2026-11-07')->assertSessionHasErrors('to');
        $this->get($base.'/insights?from=2024-01-01&to=2026-11-07')->assertSessionHasErrors('span');
    }

    public function test_zero_reports_are_zero_and_unreviewed_has_no_approval_percentage(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/insights?from=2026-11-01&to=2026-11-02')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('metrics.0.reports', 0)->where('metrics.0.approvalRate', null)->has('series', 2)->where('series.0.total', 0));
    }

    public function test_date_accordion_paginates_reports_without_losing_a_busy_day(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $rows = [];
        for ($i = 0; $i < 51; $i++) {
            $rows[] = ['tenant_id' => $tenant->id, 'membership_id' => $person->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64), 'created_at' => '2026-11-07 10:00:00', 'updated_at' => '2026-11-07 10:00:00'];
        }
        Report::query()->insert($rows);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports?range=all&employee='.$person->id)->assertOk()->assertInertia(fn (Assert $page) => $page->where('reports.total', 51)->where('summary.reports', 51));
        $path = '/tenants/'.$tenant->id.'/reports/by-day?day=2026-11-07&employee='.$person->id;
        $this->get($path)->assertOk()->assertJsonCount(50, 'data')->assertJsonPath('last_page', 2);
        $this->get($path.'&reports_page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->get('/tenants/'.$tenant->id.'/reports/by-day?day=invalid')->assertSessionHasErrors('day');
    }

    public function test_employee_date_history_cannot_read_a_coworker(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Other synthetic employee');
        $self = $this->report($tenant, $person);
        $self->update(['created_at' => '2026-11-07 10:00:00']);
        $this->report($tenant, $other)->update(['created_at' => '2026-11-07 10:00:00']);
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $person->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->get('/employee/report-days?day=2026-11-07&employee='.$other->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $self->id);
        $this->get('/tenants/'.$tenant->id.'/insights')->assertRedirect('/employee');
    }

    public function test_employee_history_attachments_are_private_and_scoped_to_own_reports(): void
    {
        Storage::fake('reports');
        [$owner, $tenant, $person] = $this->workforce();
        $coworker = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        [, $foreign, $foreignPerson] = $this->workforce();
        $reports = [$this->report($tenant, $person), $this->report($tenant, $coworker), $this->report($foreign, $foreignPerson)];
        $media = [];
        foreach ($reports as $report) {
            $report->update(['created_at' => '2026-11-07 10:00:00']);
            $path = $report->tenant_id.'/'.$report->id.'/synthetic.jpg';
            Storage::disk('reports')->put($path, 'synthetic media fixture');
            $media[] = ReportMedia::query()->create(['tenant_id' => $report->tenant_id, 'report_id' => $report->id, 'kind' => 'image', 'path' => $path, 'mime' => 'image/jpeg', 'bytes' => 23, 'sha256' => str_repeat('a', 64)]);
        }
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $person->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->get('/employee/report-days?day=2026-11-07&employee='.$coworker->id.'&tenant='.$foreign->id)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonCount(1, 'data.0.attachments')->assertJsonPath('data.0.attachments.0.id', $media[0]->id)
            ->assertJsonMissingPath('data.0.attachments.0.path')->assertJsonMissingPath('data.0.attachments.0.report_id');
        $this->get('/employee/reports/'.$reports[0]->id.'/media/'.$media[0]->id)->assertOk();
        $this->get('/employee/reports/'.$reports[0]->id.'/media/'.$media[1]->id)->assertNotFound();
        $this->get('/employee/reports/'.$reports[1]->id.'/media/'.$media[1]->id)->assertNotFound();
        $this->get('/employee/reports/'.$reports[2]->id.'/media/'.$media[2]->id)->assertNotFound();
    }
}
