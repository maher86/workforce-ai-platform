<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportParticipation;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ReportParticipationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        $this->travelTo(CarbonImmutable::parse('2026-11-22T12:00:00+04:00'));
    }

    /** @return array{User, Tenant} */
    private function company(): array
    {
        $owner = User::factory()->create();

        return [$owner, app(ManageWorkforce::class)->createTenant($owner, 'Synthetic ranking company')];
    }

    private function employee(User $owner, Tenant $tenant, string $name): Membership
    {
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, $name);
        $member->update(['created_at' => '2026-10-01 00:00:00']);

        return $member;
    }

    private function report(Membership $member, string $at = '2026-11-22 08:00:00', string $status = 'ready', string $review = 'pending'): Report
    {
        return Report::query()->create([
            'tenant_id' => $member->tenant_id, 'membership_id' => $member->id,
            'submission_key' => (string) Str::uuid(), 'content_hash' => str_repeat('a', 64),
            'status' => $status, 'review_status' => $review,
            'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    public function test_rank_ties_silent_eligibility_and_hourly_dubai_boundaries_preserve_all_report_counts(): void
    {
        [$owner, $tenant] = $this->company();
        $a = $this->employee($owner, $tenant, 'Synthetic A');
        $b = $this->employee($owner, $tenant, 'Synthetic B');
        $c = $this->employee($owner, $tenant, 'Synthetic C');
        $silent = $this->employee($owner, $tenant, 'Synthetic silent');
        $inactive = $this->employee($owner, $tenant, 'Synthetic inactive');
        $inactive->update(['active' => false]);
        $later = $this->employee($owner, $tenant, 'Joined later');
        $later->update(['created_at' => '2026-11-22 20:00:00']);
        [$foreignOwner, $foreignTenant] = $this->company();
        $foreign = $this->employee($foreignOwner, $foreignTenant, 'Foreign');
        $this->report($foreign);
        $this->report($a, '2026-11-21 19:59:59');
        $this->report($a, '2026-11-21 20:00:00', 'submitted');
        $this->report($a, '2026-11-22 04:00:00', 'processing', 'approved');
        $this->report($a, '2026-11-22 19:59:59', 'failed', 'changes_requested');
        $this->report($a, '2026-11-22 20:00:00');
        $this->report($a)->delete();
        for ($i = 0; $i < 3; $i++) {
            $this->report($b);
        }
        $this->report($c);
        $this->report($inactive);
        $this->report($inactive);

        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.reports', 9)->where('chartGrain', 'hour')->has('chartSeries', 24)
            ->where('chartSeries.0.day', '00:00')->where('chartSeries.0.total', 1)->where('chartSeries.23.total', 1)
            ->where('participation.eligible', 4)->where('participation.silent', [$silent->id])
            ->where('participation.ranked', [
                ['membership_id' => $a->id, 'reports' => 3, 'rank' => 1],
                ['membership_id' => $b->id, 'reports' => 3, 'rank' => 1],
                ['membership_id' => $c->id, 'reports' => 1, 'rank' => 3],
            ])->has('participation.distribution', 4)
            ->where('participation.distribution.3.membership_id', $inactive->id)->where('participation.distribution.3.reports', 2)
            ->where('chartSeries', fn ($rows) => collect($rows)->sum('total') === 9));
        $this->get('/tenants/'.$tenant->id.'/reports?employee='.$a->id)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.reports', 3)->where('participation.ranked', [])->where('chartSeries', fn ($rows) => collect($rows)->sum('total') === 3));
    }

    public function test_week_month_and_pagination_use_full_period_counts_and_empty_period_has_no_fake_rank(): void
    {
        [$owner, $tenant] = $this->company();
        $member = $this->employee($owner, $tenant, 'Synthetic');
        $this->report($member, '2026-10-31 20:00:00');
        $this->report($member, '2026-11-15 19:59:59');
        $this->report($member, '2026-11-15 20:00:00');
        for ($i = 0; $i < 26; $i++) {
            $this->report($member);
        }
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports?range=7&page=2')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('period.from', '2026-11-16')->where('participation.ranked.0.reports', 27)->where('summary.reports', 27)->has('reports.data', 2)->where('chartGrain', 'day'));
        $this->get('/tenants/'.$tenant->id.'/reports?range=month')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('period.from', '2026-11-01')->where('participation.ranked.0.reports', 29));
        $this->get('/tenants/'.$tenant->id.'/reports?range=yesterday')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('summary.reports', 0)->where('participation.ranked', [])->where('participation.silent', [$member->id])
            ->where('chartSeries', fn ($rows) => collect($rows)->sum('total') === 0));
    }

    public function test_foreign_routes_filters_and_employee_role_cannot_read_participation(): void
    {
        [$owner, $tenant] = $this->company();
        $member = $this->employee($owner, $tenant, 'Synthetic');
        [$foreignOwner, $foreignTenant] = $this->company();
        $foreign = $this->employee($foreignOwner, $foreignTenant, 'Foreign');
        $this->actingAs($owner)->get('/tenants/'.$foreignTenant->id.'/reports')->assertNotFound();
        $this->get('/tenants/'.$tenant->id.'/reports?employee='.$foreign->id)->assertNotFound();
        $this->expectException(HttpException::class);
        app(ReportParticipation::class)->summarize(User::query()->findOrFail($member->user_id), $tenant->id, ['from' => '2026-11-22', 'to' => '2026-11-22']);
    }

    public function test_fifty_employee_read_has_bounded_queries_and_no_per_employee_count_queries(): void
    {
        [$owner, $tenant] = $this->company();
        for ($i = 0; $i < 50; $i++) {
            $member = $this->employee($owner, $tenant, 'Synthetic '.$i);
            if ($i < 45) {
                $this->report($member);
            }
        }
        DB::enableQueryLog();
        DB::flushQueryLog();
        $result = app(ReportParticipation::class)->summarize($owner, $tenant->id, ['from' => '2026-11-22', 'to' => '2026-11-22']);
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertLessThanOrEqual(5, $queries);
        $this->assertSame(50, $result['eligible']);
        $this->assertCount(45, $result['ranked']);
        $this->assertCount(5, $result['silent']);
        $this->assertSame(45, array_sum(array_column($result['distribution'], 'reports')));
    }
}
