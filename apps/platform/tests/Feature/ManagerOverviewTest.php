<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use App\Modules\WorkManagement\ReportVehicle;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ManagerOverviewTest extends TestCase
{
    use RefreshDatabase;

    /** @return array{User, Tenant, Membership} */
    private function workforce(): array
    {
        Http::preventStrayRequests();
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic overview');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');

        return [$owner, $tenant, $member];
    }

    private function report(Membership $member, string $at, string $review = 'pending'): Report
    {
        return Report::query()->create([
            'tenant_id' => $member->tenant_id, 'membership_id' => $member->id,
            'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64),
            'source_text' => 'Synthetic report, no completion inferred.', 'status' => 'ready', 'review_status' => $review,
            'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    public function test_dashboard_defaults_to_dubai_today_and_counts_without_approval(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-08T01:00:00+04:00'));
        [$owner, $tenant, $member] = $this->workforce();
        [, , $foreign] = $this->workforce();
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Second synthetic employee');
        $member->update(['profile_photo_path' => 'profiles/'.$tenant->id.'/'.$member->id.'/synthetic-avatar.jpg', 'phone' => '+15550001111']);
        $this->report($member, '2026-11-07 19:59:59');
        $this->report($member, '2026-11-07 20:00:00');
        $this->report($other, '2026-11-08 05:00:00', 'approved');
        $this->report($member, '2026-11-08 19:59:59', 'changes_requested');
        $this->report($member, '2026-11-08 20:00:00');
        $this->report($member, '2026-11-08 06:00:00')->delete();
        $this->report($foreign, '2026-11-08 05:00:00');

        $this->actingAs($owner)->get('/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->component('reports/index')
            ->where('range', 'today')->where('period.from', '2026-11-08')->where('period.to', '2026-11-08')
            ->where('summary.reports', 3)->where('summary.contributors', 2)->where('series.0.total', 3)
            ->has('reports.data', 3)->has('people', 2)->where('people.0.phone', '+15550001111')
            ->where('people.0.photo', fn ($url) => str_starts_with($url, '/tenants/'.$tenant->id.'/employees/'.$member->id.'/photo?'))
            ->missing('reports.data.0.review_status'));
        $this->get('/tenants/'.$tenant->id.'/reports?employee='.$other->id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.reports', 1)->where('reports.data.0.membership_id', $other->id));
    }

    public function test_profile_includes_all_history_and_custom_period_uses_inclusive_dates(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-08T12:00:00+04:00'));
        [$owner, $tenant, $member] = $this->workforce();
        $this->report($member, '2024-10-01 10:00:00');
        $this->report($member, '2026-11-07 20:00:00');
        $this->report($member, '2026-11-08 19:59:59');
        $this->report($member, '2026-11-08 20:00:00');
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/employees/'.$member->id.'/reports')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('profile', true)->where('range', 'all')->where('monthly', true)
                ->where('summary.reports', 3)->where('selectedEmployee', $member->id)->where('series.0.day', '2024-10')->where('series.0.total', 1));
        $this->get('/tenants/'.$tenant->id.'/reports?range=custom&from=2026-11-08&to=2026-11-08')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.reports', 2)->where('series.0.total', 2));
        $this->get('/tenants/'.$tenant->id.'/reports?range=custom&from=2026-11-09&to=2026-11-08')->assertSessionHasErrors('to');
        $this->get('/tenants/'.$tenant->id.'/reports?range=custom&from=2024-01-01&to=2026-11-08')->assertSessionHasErrors('span');
    }

    public function test_tenant_and_profile_filters_never_disclose_foreign_members(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        [, $foreignTenant, $foreignMember] = $this->workforce();
        $this->actingAs($owner)->get('/tenants/'.$foreignTenant->id.'/reports')->assertNotFound();
        $this->get('/tenants/'.$tenant->id.'/reports?employee='.$foreignMember->id)->assertNotFound();
        $this->get('/tenants/'.$tenant->id.'/employees/'.$foreignMember->id.'/reports')->assertNotFound();
        Membership::query()->create(['tenant_id' => $foreignTenant->id, 'user_id' => $owner->id, 'role' => 'employee']);
        $this->get('/tenants/'.$foreignTenant->id.'/reports')->assertForbidden();
        $this->get('/tenants/'.$foreignTenant->id.'/employees/'.$foreignMember->id.'/reports')->assertForbidden();
        $this->get('/tenants/'.$tenant->id.'/employees/'.$member->id.'/reports?employee='.$foreignMember->id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('selectedEmployee', $member->id)->has('people', 1));
    }

    public function test_report_pagination_does_not_change_full_period_counts_or_chart(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-08T12:00:00+04:00'));
        [$owner, $tenant, $member] = $this->workforce();
        $rows = [];
        for ($i = 0; $i < 26; $i++) {
            $rows[] = ['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('b', 64), 'created_at' => '2026-11-08 06:00:00', 'updated_at' => '2026-11-08 06:00:00'];
        }
        Report::query()->insert($rows);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.reports', 26)->where('series.0.total', 26)->where('reports.total', 26)->has('reports.data', 25));
        $this->get('/tenants/'.$tenant->id.'/reports?page=2')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.reports', 26)->has('reports.data', 1));
    }

    public function test_vehicle_filter_preserves_counts_and_denies_foreign_vehicle_ids(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        [$otherOwner, $foreignTenant, $foreignMember] = $this->workforce();
        $report = $this->report($member, now()->toDateTimeString());
        $this->report($member, now()->toDateTimeString());
        $foreign = $this->report($foreignMember, now()->toDateTimeString());
        app(ReportVehicle::class)->assign($owner, $tenant->id, $report->id, 'TEST A 123');
        app(ReportVehicle::class)->assign($otherOwner, $foreignTenant->id, $foreign->id, 'TEST B 456');
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports?vehicle='.$report->fresh()->vehicle_id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('summary.reports', 1)->where('reports.total', 1)->where('vehicle.plate', 'TEST A 123'));
        $this->get('/tenants/'.$tenant->id.'/reports?vehicle='.$foreign->fresh()->vehicle_id)->assertNotFound();
    }
}
