<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class VehicleInsightsTest extends TestCase
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
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic vehicle workspace');
        $person = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');

        return [$owner, $tenant, $person];
    }

    private function report(Tenant $tenant, Membership $person, ?string $plate = null): Report
    {
        return app(SubmitReport::class)->execute(User::query()->findOrFail($person->user_id), $tenant->id, (string) Str::uuid(), 'Synthetic work described, not verified complete.', [], vehiclePlate: $plate);
    }

    public function test_two_employees_share_one_car_and_can_work_on_other_cars(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Second synthetic worker');
        $first = $this->report($tenant, $person, 'TEST A 123');
        $second = $this->report($tenant, $other, 'test-a-١٢٣');
        $this->assertSame($first->vehicle_id, $second->vehicle_id);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/vehicles')->assertOk()->assertInertia(fn (Assert $page) => $page->component('vehicles/index')->where('vehicles.data.0.employee_count', 2)->where('vehicles.data.0.report_count', 2));
        $this->get('/tenants/'.$tenant->id.'/vehicles/'.$first->vehicle_id)->assertOk()->assertInertia(fn (Assert $page) => $page->component('vehicles/show')->has('contributors', 2)->where('total', 2));
        $third = $this->report($tenant, $person, 'TEST B 999');
        $this->assertNotSame($first->vehicle_id, $third->vehicle_id);
        $this->assertDatabaseCount('vehicles', 2);
    }

    public function test_vehicle_is_tenant_scoped_and_foreign_ids_cannot_be_used(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        [, $foreign, $foreignPerson] = $this->workforce();
        $own = $this->report($tenant, $person, 'TEST A 123');
        $other = $this->report($foreign, $foreignPerson, 'TEST A 123');
        $this->assertNotSame($own->vehicle_id, $other->vehicle_id);
        $base = '/tenants/'.$tenant->id;
        $this->actingAs($owner)->get($base.'/vehicles/'.$other->vehicle_id)->assertNotFound();
        $this->get('/tenants/'.$foreign->id.'/vehicles')->assertNotFound();
        $this->get($base.'/reports/by-day?day=2026-11-07&vehicle='.$other->vehicle_id)->assertNotFound();
        $this->get($base.'/insights?employee='.$foreignPerson->id)->assertNotFound();
        $this->post($base.'/reports/'.$other->id.'/vehicle', ['vehicle_plate' => 'TEST Z 1'])->assertNotFound();
    }

    public function test_database_rejects_a_cross_tenant_vehicle_relation(): void
    {
        [, $tenant, $person] = $this->workforce();
        [, $foreign, $other] = $this->workforce();
        $report = $this->report($tenant, $person);
        $vehicle = $this->report($foreign, $other, 'TEST FOREIGN 1')->vehicle_id;
        $this->expectException(QueryException::class);
        $report->update(['vehicle_id' => $vehicle]);
    }

    public function test_plate_participates_in_idempotency_and_equivalent_formats_reuse_it(): void
    {
        [, $tenant, $person] = $this->workforce();
        $actor = User::query()->findOrFail($person->user_id);
        $key = (string) Str::uuid();
        $first = app(SubmitReport::class)->execute($actor, $tenant->id, $key, 'Synthetic text.', [], vehiclePlate: 'TEST A 123');
        $again = app(SubmitReport::class)->execute($actor, $tenant->id, $key, 'Synthetic text.', [], vehiclePlate: 'test-a-123');
        $this->assertSame($first->id, $again->id);
        try {
            app(SubmitReport::class)->execute($actor, $tenant->id, $key, 'Synthetic text.', [], vehiclePlate: 'TEST B 999');
            $this->fail('Different vehicle bypassed idempotency');
        } catch (ValidationException) {
            $this->assertDatabaseCount('vehicles', 1);
            $this->assertDatabaseCount('reports', 1);
        }
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
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports?employee='.$person->id)->assertOk()->assertInertia(fn (Assert $page) => $page->where('days.data.0.total', 51));
        $path = '/tenants/'.$tenant->id.'/reports/by-day?day=2026-11-07&employee='.$person->id;
        $this->get($path)->assertOk()->assertJsonCount(50, 'data')->assertJsonPath('last_page', 2);
        $this->get($path.'&reports_page=2')->assertOk()->assertJsonCount(1, 'data');
        $this->get('/tenants/'.$tenant->id.'/reports/by-day?day=invalid')->assertSessionHasErrors('day');
    }

    public function test_employee_date_history_cannot_read_a_coworker_even_on_same_car(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Other synthetic employee');
        $self = $this->report($tenant, $person, 'TEST A 123');
        $self->update(['created_at' => '2026-11-07 10:00:00']);
        $this->report($tenant, $other, 'TEST A 123')->update(['created_at' => '2026-11-07 10:00:00']);
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $person->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->get('/employee/report-days?day=2026-11-07&employee='.$other->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $self->id);
        $this->get('/tenants/'.$tenant->id.'/insights')->assertRedirect('/employee');
    }

    public function test_manager_can_link_and_unlink_existing_report_without_changing_evidence(): void
    {
        [$owner, $tenant, $person] = $this->workforce();
        $report = $this->report($tenant, $person);
        $hash = $report->content_hash;
        $base = '/tenants/'.$tenant->id.'/reports/'.$report->id;
        $this->actingAs($owner)->post($base.'/vehicle', ['vehicle_plate' => 'TEST A 123'])->assertRedirect();
        $this->assertNotNull($report->fresh()->vehicle_id);
        $this->assertSame($hash, $report->fresh()->content_hash);
        $this->get($base)->assertOk()->assertInertia(fn (Assert $page) => $page->where('vehicle.plate', 'TEST A 123'));
        $this->post($base.'/vehicle', ['vehicle_plate' => ''])->assertRedirect();
        $this->assertNull($report->fresh()->vehicle_id);
        $this->assertSame($hash, $report->fresh()->content_hash);
    }
}
