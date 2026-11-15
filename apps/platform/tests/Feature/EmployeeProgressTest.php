<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmployeeProgressTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create();
        $workforce = app(ManageWorkforce::class);
        $tenant = $workforce->createTenant($owner, 'Synthetic progress tenant');
        $member = $workforce->addEmployee($owner, $tenant->id, 'Synthetic progress employee');
        $report = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64), 'status' => 'submitted']);
        $grant = app(EmployeeActivation::class)->consume(app(EmployeeActivation::class)->issue($owner, $tenant->id, $member->id));

        return [$owner, $tenant, $member, $report, $grant];
    }

    public function test_progress_tracks_real_stages_without_returning_evidence_or_false_readiness(): void
    {
        $this->withoutVite();
        [, $tenant, , $report, $grant] = $this->fixture();
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->withCredentials();
        $url = '/employee/report-progress?ids[]='.$report->id;
        $this->getJson($url)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertExactJson(['reports' => [['id' => $report->id, 'source_version' => 1, 'status' => 'submitted', 'phase' => 'queued']]]);
        $report->update(['status' => 'processing']);
        $this->getJson($url)->assertJsonPath('reports.0.phase', 'translating');
        ReportMedia::query()->create(['tenant_id' => $tenant->id, 'report_id' => $report->id, 'kind' => 'audio', 'path' => $tenant->id.'/'.$report->id.'/synthetic.m4a', 'mime' => 'audio/mp4', 'bytes' => 1, 'duration' => 1, 'sha256' => str_repeat('b', 64)]);
        $this->getJson($url)->assertJsonPath('reports.0.phase', 'transcribing');
        foreach (['transcript:synthetic', 'translation'] as $stage) {
            ReportOutput::query()->create(['tenant_id' => $tenant->id, 'report_id' => $report->id, 'stage' => $stage, 'provider' => 'demo', 'model' => 'synthetic', 'prompt_version' => 'workforce-v1', 'schema_version' => '1', 'payload' => ['text' => 'Synthetic evidence must stay private']]);
            $response = $this->getJson($url)->assertJsonPath('reports.0.status', 'processing')->assertJsonPath('reports.0.phase', $stage === 'translation' ? 'finalizing' : 'translating');
            $this->assertStringNotContainsString('Synthetic evidence', $response->getContent());
        }
        $report->update(['status' => 'ready']);
        $this->getJson($url)->assertJsonPath('reports.0.phase', 'ready');
        $report->delete();
        $this->getJson($url)->assertJsonPath('reports.0.status', 'withdrawn')->assertJsonPath('reports.0.phase', 'withdrawn');
    }

    public function test_progress_denies_other_tenants_coworkers_stale_devices_and_unbounded_batches(): void
    {
        $this->withoutVite();
        [$owner, $tenant, , $report, $grant] = $this->fixture();
        [, , , $foreignReport] = $this->fixture();
        $coworker = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        $coworkerReport = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $coworker->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64)]);
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $this->withCredentials();
        foreach ([$foreignReport->id, $coworkerReport->id] as $foreign) {
            $this->getJson('/employee/report-progress?ids[]='.$report->id.'&ids[]='.$foreign)->assertNotFound();
        }
        $this->getJson('/employee/report-progress?'.http_build_query(['ids' => range(1, 21)]))->assertUnprocessable();
        $this->getJson('/employee/report-progress?ids[]='.$report->id.'&ids[]='.$report->id)->assertUnprocessable();
        $this->withHeader('X-Employee-Upload-Scope', 'stale:device')->getJson('/employee/report-progress?ids[]='.$report->id)->assertConflict();
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $report->membership_id);
        $this->getJson('/employee/report-progress?ids[]='.$report->id)->assertRedirect('/employee/connect');
    }
}
