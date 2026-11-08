<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\ConfirmServiceFacts;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\ReportServiceFact;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ServiceFactsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Queue::fake();
    }

    /** @return array{User, Tenant, Membership, Report} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic service workspace');
        $person = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $report = app(SubmitReport::class)->execute(User::query()->findOrFail($person->user_id), $tenant->id, (string) Str::uuid(), 'Synthetic evidence, no duration or completion inferred.', []);

        return [$owner, $tenant, $person, $report];
    }

    /** @return array<string, mixed> */
    private function facts(): array
    {
        return ['source_version' => 1, 'version' => 0, 'service_type' => 'Synthetic oil service', 'started_at' => '2026-01-01T23:30', 'ended_at' => '2026-01-02T00:30', 'rework' => true, 'rework_reason' => 'Synthetic documented return', 'confirmation_note' => 'Synthetic manager checked original source.'];
    }

    public function test_manager_appends_revisions_converts_dubai_time_and_preserves_evidence(): void
    {
        [$owner, $tenant, , $report] = $this->workforce();
        $original = $report->refresh()->getAttributes();
        $output = ReportOutput::query()->create(['tenant_id' => $tenant->id, 'report_id' => $report->id, 'stage' => 'translation', 'provider' => 'demo', 'model' => 'synthetic', 'prompt_version' => '1', 'schema_version' => '1', 'payload' => ['english' => 'Synthetic source translation; duration unknown.']])->refresh();
        $originalOutput = $output->getAttributes();
        $url = '/tenants/'.$tenant->id.'/reports/'.$report->id;
        $this->actingAs($owner)->post($url.'/service-facts', $this->facts())->assertRedirect()->assertSessionHasNoErrors();
        $fact = ReportServiceFact::query()->firstOrFail();
        $this->assertSame('2026-01-01 19:30:00', $fact->getAttribute('started_at')->utc()->format('Y-m-d H:i:s'));
        $this->assertTrue($fact->getAttribute('rework'));
        $this->post($url.'/service-facts', ['source_version' => 1, 'version' => 1, 'rework' => null, 'confirmation_note' => 'Correcting classification; interval unknown.'])->assertSessionHasNoErrors();
        $this->assertDatabaseCount('report_service_facts', 2);
        $this->assertSame($original, $report->fresh()->getAttributes());
        $this->assertSame($originalOutput, $output->fresh()->getAttributes());
        $this->assertDatabaseCount('report_revisions', 0);
        $this->assertDatabaseHas('report_service_facts', ['id' => $fact->id, 'rework' => true]);
        $this->post($url.'/service-facts', $this->facts())->assertSessionHasErrors('version');
        $this->assertDatabaseCount('report_service_facts', 2);
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->where('currentServiceFact.version', 2)->where('currentServiceFact.rework', null)->has('serviceFacts.data', 2));
    }

    public function test_invalid_intervals_rework_and_blank_confirmation_are_rejected(): void
    {
        [$owner, $tenant, , $report] = $this->workforce();
        $url = '/tenants/'.$tenant->id.'/reports/'.$report->id.'/service-facts';
        $this->actingAs($owner);
        foreach ([['ended_at' => null], ['started_at' => null], ['ended_at' => '2026-01-01T20:00'], ['ended_at' => '2099-01-01T20:00'], ['started_at' => '2026-02-30T20:00'], ['rework_reason' => '  '], ['confirmation_note' => '  '], ['rework' => 'unknown'], ['service_type' => str_repeat('a', 101)]] as $change) {
            $this->post($url, array_replace($this->facts(), $change))->assertSessionHasErrors();
        }
        $this->assertDatabaseCount('report_service_facts', 0);
    }

    public function test_other_tenant_report_and_employee_role_are_denied_even_through_shared_action(): void
    {
        [$owner, $tenant, $person, $report] = $this->workforce();
        [, $foreign, , $other] = $this->workforce();
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/reports/'.$other->id.'/service-facts', $this->facts())->assertNotFound();
        $this->post('/tenants/'.$foreign->id.'/reports/'.$other->id.'/service-facts', $this->facts())->assertNotFound();
        // Actor has manager rights in one tenant and only employee rights in the other.
        Membership::query()->create(['tenant_id' => $foreign->id, 'user_id' => $owner->id, 'role' => 'employee', 'active' => true]);
        $this->post('/tenants/'.$foreign->id.'/reports/'.$other->id.'/service-facts', $this->facts())->assertForbidden();
        try {
            app(ConfirmServiceFacts::class)->execute(User::query()->findOrFail($person->user_id), $tenant->id, $report->id, $this->facts());
            $this->fail('Employee confirmed service facts');
        } catch (HttpException $error) {
            $this->assertSame(403, $error->getStatusCode());
        }
        $this->assertDatabaseCount('report_service_facts', 0);
    }

    public function test_latest_facts_only_and_unknowns_have_explicit_denominators_and_employee_filters(): void
    {
        [$owner, $tenant, , $report] = $this->workforce();
        $second = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Second synthetic employee');
        $other = app(SubmitReport::class)->execute(User::query()->findOrFail($second->user_id), $tenant->id, (string) Str::uuid(), 'Synthetic second report.', []);
        $third = app(SubmitReport::class)->execute(User::query()->findOrFail($second->user_id), $tenant->id, (string) Str::uuid(), 'Synthetic unknown facts.', []);
        foreach ([$report, $other, $third] as $item) {
            $item->update(['created_at' => '2026-01-01 20:00:00']);
        }
        $action = app(ConfirmServiceFacts::class);
        $action->execute($owner, $tenant->id, $report->id, $this->facts());
        $action->execute($owner, $tenant->id, $report->id, array_replace($this->facts(), ['source_version' => 1, 'version' => 1, 'rework' => false]));
        $action->execute($owner, $tenant->id, $other->id, ['source_version' => 1, 'version' => 0, 'rework' => true, 'rework_reason' => 'Synthetic return', 'confirmation_note' => 'Synthetic verification']);
        $url = '/tenants/'.$tenant->id.'/insights?from=2026-01-02&to=2026-01-02';
        $this->actingAs($owner)->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('serviceInsights.confirmed', 2)->where('serviceInsights.assessed', 2)->where('serviceInsights.reworks', 1)->where('serviceInsights.reworkRate', 50)
            ->where('serviceInsights.timed', 1)->where('serviceInsights.averageMinutes', 60)->where('serviceInsights.classified', 1)->has('serviceInsights.services', 1));
        $this->get($url.'&employee='.$second->id)->assertInertia(fn (Assert $page) => $page->where('serviceInsights.confirmed', 1)->where('serviceInsights.reworkRate', 100)->where('serviceInsights.averageMinutes', null));
        $this->get('/tenants/'.$tenant->id.'/insights?from=2026-01-03&to=2026-01-03')->assertInertia(fn (Assert $page) => $page->where('serviceInsights.confirmed', 0)->where('serviceInsights.reworkRate', null)->where('serviceInsights.averageMinutes', null));
    }

    public function test_foreign_tenant_fact_is_rejected_by_database(): void
    {
        [$owner, , , $report] = $this->workforce();
        [, $foreign] = $this->workforce();
        $this->expectException(QueryException::class);
        ReportServiceFact::query()->create(['tenant_id' => $foreign->id, 'report_id' => $report->id, 'actor_id' => $owner->id, 'version' => 1, 'confirmation_note' => 'Synthetic invalid association']);
    }

    public function test_report_deletion_removes_service_history(): void
    {
        [$owner, $tenant, , $report] = $this->workforce();
        app(ConfirmServiceFacts::class)->execute($owner, $tenant->id, $report->id, $this->facts());
        $report->forceDelete();
        $this->assertDatabaseCount('report_service_facts', 0);
    }
}
