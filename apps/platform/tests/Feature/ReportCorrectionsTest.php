<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\AIProcessing\ProcessReport;
use App\Modules\AIProcessing\ReportAI;
use App\Modules\AIProcessing\ReportPipeline;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Media\MediaInput;
use App\Modules\Media\PreparedMedia;
use App\Modules\Media\PrepareMedia;
use App\Modules\Reporting\ChangeEmployeeReport;
use App\Modules\Reporting\ConfirmServiceFacts;
use App\Modules\Reporting\PurgeReport;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\ReportSourceChange;
use App\Modules\Reporting\ReviewReport;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class ReportCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<UploadedFile> */
    private array $uploads = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->travelTo(CarbonImmutable::parse('2026-11-08 08:00:00 UTC'));
        Queue::fake();
        Storage::fake('reports');
        $prepare = Mockery::mock(PrepareMedia::class);
        $prepare->shouldReceive('prepare')->andReturnUsing(function (MediaInput $input) {
            $path = '.incoming/'.Str::uuid().($input->kind === 'audio' ? '.m4a' : '.jpg');
            Storage::disk('reports')->put($path, 'synthetic prepared fixture');

            return new PreparedMedia($path, $input->kind, $input->kind === 'audio' ? 'audio/mp4' : 'image/jpeg', 100, hash_file('sha256', $input->sourcePath), $input->kind === 'audio' ? 5.0 : null);
        });
        $this->app->instance(PrepareMedia::class, $prepare);
    }

    /** @return array{User, Tenant, Membership, Report, ReportMedia} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic corrections workspace');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic correction worker');
        $report = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64), 'status' => 'ready'])->refresh();
        $media = $this->media($report, 'audio');

        return [$owner, $tenant, $member, $report, $media];
    }

    private function media(Report $report, string $kind): ReportMedia
    {
        $path = $report->tenant_id.'/'.$report->id.'/'.Str::uuid();
        Storage::disk('reports')->put($path, 'synthetic original fixture');

        return ReportMedia::query()->create(['tenant_id' => $report->tenant_id, 'report_id' => $report->id, 'path' => $path, 'kind' => $kind, 'mime' => $kind === 'audio' ? 'audio/mp4' : 'image/jpeg', 'bytes' => 100, 'duration' => $kind === 'audio' ? 5 : null, 'sha256' => str_repeat('b', 64)]);
    }

    private function input(string $kind, string $content = 'synthetic input'): MediaInput
    {
        $file = UploadedFile::fake()->createWithContent('synthetic.bin', $content);
        $this->uploads[] = $file;

        return new MediaInput($file->getPathname(), $kind);
    }

    private function actor(Membership $member): User
    {
        return User::query()->findOrFail($member->user_id);
    }

    private function stageOutput(Report $report, string $stage, array $payload): ReportOutput
    {
        return ReportOutput::query()->create(['tenant_id' => $report->tenant_id, 'report_id' => $report->id, 'stage' => $stage, 'provider' => 'demo', 'model' => 'synthetic', 'prompt_version' => '1', 'schema_version' => '1', 'payload' => $payload]);
    }

    public function test_replacing_voice_preserves_previous_evidence_and_resets_approval(): void
    {
        [$owner, $tenant, $member, $report, $audio] = $this->workforce();
        $this->stageOutput($report, 'transcript:'.$audio->id, ['text' => 'Original synthetic source.']);
        $this->stageOutput($report, 'translation', ['english' => 'Original synthetic translation.']);
        $this->stageOutput($report, 'structured', ['summary' => 'Original synthetic report.']);
        app(ReviewReport::class)->execute($owner, $tenant->id, $report->id, 1, 'Synthetic approval.', 'Synthetic source checked.', 'approved');
        app(ConfirmServiceFacts::class)->execute($owner, $tenant->id, $report->id, ['source_version' => 1, 'version' => 0, 'service_type' => 'Synthetic', 'rework' => false, 'confirmation_note' => 'Synthetic source checked.']);
        $key = (string) Str::uuid();
        $input = $this->input('audio');
        $change = app(ChangeEmployeeReport::class);
        $current = $change->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [$audio->id], [$input]);
        $this->assertSame(2, $current->source_version);
        $this->assertSame('pending', $current->review_status);
        $this->assertSame($report->created_at->timestamp, $current->created_at->timestamp);
        $this->assertNotNull($audio->fresh()->getAttribute('retired_at'));
        Storage::disk('reports')->assertExists($audio->path);
        $snapshot = ReportSourceChange::query()->sole();
        $this->assertCount(3, $snapshot->getAttribute('outputs'));
        $this->assertSame([$audio->id], $snapshot->getAttribute('media_ids'));
        $this->assertDatabaseCount('report_revisions', 1);
        $this->assertDatabaseCount('report_outputs', 0);
        $this->assertSame('transcript:'.ReportMedia::query()->whereNull('retired_at')->sole()->id, app(ReportPipeline::class)->next($current)['key']);
        $change->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [$audio->id], [$input]);
        $this->assertDatabaseCount('report_source_changes', 1);
        $this->assertDatabaseCount('report_media', 2);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertInertia(fn (Assert $page) => $page->has('revisions', 0)->has('media', 1)->has('sourceChanges.data', 1));
        $this->get('/tenants/'.$tenant->id.'/reports/'.$report->id.'/source-history/'.$snapshot->id)->assertOk()->assertJsonCount(3, 'outputs')->assertJsonCount(1, 'reviews');
        $this->post('/tenants/'.$tenant->id.'/reports/'.$report->id.'/service-facts', ['source_version' => 1, 'version' => 1, 'confirmation_note' => 'Stale manager form.'])->assertSessionHasErrors('source_version');
        $this->get('/tenants/'.$tenant->id.'/insights?from=2026-11-08&to=2026-11-08')->assertInertia(fn (Assert $page) => $page->where('serviceInsights.confirmed', 0));
        app(ConfirmServiceFacts::class)->execute($owner, $tenant->id, $report->id, ['source_version' => 2, 'version' => 1, 'rework' => false, 'confirmation_note' => 'Confirmed updated sources.']);
        $this->get('/tenants/'.$tenant->id.'/insights?from=2026-11-08&to=2026-11-08')->assertInertia(fn (Assert $page) => $page->where('serviceInsights.confirmed', 1));
    }

    public function test_add_image_reuses_unchanged_transcript_and_translation_but_rebuilds_report(): void
    {
        [, $tenant, $member, $report, $audio] = $this->workforce();
        $this->stageOutput($report, 'transcript:'.$audio->id, ['text' => 'Synthetic audio.']);
        $translation = $this->stageOutput($report, 'translation', ['english' => 'Synthetic translation.']);
        $this->stageOutput($report, 'structured', ['summary' => 'Synthetic old report.']);
        $current = app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, (string) Str::uuid(), [$audio->id], [$this->input('image')]);
        $this->assertNull($audio->fresh()->getAttribute('retired_at'));
        $this->assertDatabaseHas('report_outputs', ['id' => $translation->id]);
        $this->assertDatabaseMissing('report_outputs', ['stage' => 'structured']);
        $this->assertSame('image', app(ReportPipeline::class)->next($current)['kind']);
    }

    public function test_hour_is_anchored_to_original_submission_and_exact_boundary_is_closed(): void
    {
        [, $tenant, $member, $report, $audio] = $this->workforce();
        $this->travel(59)->minutes();
        $this->travel(59)->seconds();
        app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, (string) Str::uuid(), [$audio->id], [$this->input('image')]);
        $this->travel(1)->seconds();
        foreach ([false, true] as $delete) {
            try {
                app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 2, (string) Str::uuid(), [$audio->id], [], $delete);
                $this->fail('Hour boundary was bypassed');
            } catch (ValidationException) {
                $this->assertFalse($report->fresh()->trashed());
            }
        }
        $this->assertSame(2, $report->fresh()->source_version);
    }

    public function test_own_report_delete_is_soft_idempotent_hidden_and_purged_with_all_evidence(): void
    {
        [$owner, $tenant, $member, $report, $audio] = $this->workforce();
        $key = (string) Str::uuid();
        $action = app(ChangeEmployeeReport::class);
        $action->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [], [], true);
        $action->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [], [], true);
        $this->assertNull(Report::query()->find($report->id));
        $this->assertTrue(Report::withTrashed()->findOrFail($report->id)->trashed());
        Storage::disk('reports')->assertExists($audio->path);
        $this->assertDatabaseCount('report_source_changes', 1);
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertOk();
        $this->get('/tenants/'.$tenant->id.'/reports')->assertInertia(fn (Assert $page) => $page->has('reports.data', 0));
        $ai = Mockery::mock(ReportAI::class);
        $ai->shouldNotReceive('run');
        (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), $ai);
        app(PurgeReport::class)->execute($tenant->id, $report->id, $owner->id);
        $this->assertDatabaseCount('report_source_changes', 0);
        Storage::disk('reports')->assertMissing($audio->path);
    }

    public function test_old_job_cannot_process_or_fail_newer_source_version(): void
    {
        [, $tenant, $member, $report, $audio] = $this->workforce();
        app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, (string) Str::uuid(), [$audio->id], [$this->input('image')]);
        $old = new ProcessReport($tenant->id, $report->id, 1);
        $ai = Mockery::mock(ReportAI::class);
        $ai->shouldNotReceive('run');
        $old->handle(app(ReportPipeline::class), $ai);
        $old->failed(null);
        $this->assertSame('submitted', $report->fresh()->status);
        Queue::assertPushed(ProcessReport::class, fn (ProcessReport $job) => $job->sourceVersion === 2);
    }

    public function test_stale_edit_foreign_media_and_image_without_audio_are_rejected(): void
    {
        [, $tenant, $member, $report, $audio] = $this->workforce();
        [, , , , $foreignAudio] = $this->workforce();
        foreach ([[2, [$audio->id], [$this->input('image')]], [1, [$foreignAudio->id], []], [1, [], [$this->input('image')]]] as [$version, $keep, $inputs]) {
            try {
                app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, $version, (string) Str::uuid(), $keep, $inputs);
                $this->fail('Invalid edit accepted');
            } catch (ValidationException) {
                $this->assertSame(1, $report->fresh()->source_version);
                $this->assertSame([], Storage::disk('reports')->allFiles('.incoming'));
            }
        }
        $this->assertDatabaseCount('report_source_changes', 0);
    }

    public function test_device_routes_period_filters_and_foreign_report_denial(): void
    {
        [$owner, $tenant, $member, $report, $audio] = $this->workforce();
        [, , , $foreign] = $this->workforce();
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $member->id));
        $this->withCookie('workforce_device', $grant['token'])->withCredentials()->get('/employee')->assertOk();
        $data = ['source_version' => 1, 'change_key' => (string) Str::uuid()];
        $this->postJson('/employee/reports/'.$foreign->id.'/amend', $data)->assertNotFound();
        $this->deleteJson('/employee/reports/'.$foreign->id, $data)->assertNotFound();
        $this->get('/employee/history?from=2026-11-08&to=2026-11-08&employee='.$other->id)->assertOk()->assertInertia(fn (Assert $page) => $page->where('days.data.0.total', 1));
        $this->get('/employee/report-days?day=2026-11-08&from=2026-11-09&to=2026-11-09')->assertJsonCount(0, 'data');
        $this->get('/employee/history?from=2026-11-09&to=2026-11-08')->assertSessionHasErrors('to');
        $this->deleteJson('/employee/reports/'.$report->id, $data)->assertOk();
        $this->get('/employee/reports/'.$report->id)->assertNotFound();
        $this->get('/employee/reports/'.$report->id.'/media/'.$audio->id)->assertNotFound();
    }

    public function test_conflicting_retry_storage_limit_and_foreign_history_do_not_mutate_sources(): void
    {
        [$owner, $tenant, $member, $report, $audio] = $this->workforce();
        [, $foreign, $foreignMember, $other, $otherAudio] = $this->workforce();
        $key = (string) Str::uuid();
        app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [$audio->id], [$this->input('image', 'first image')]);
        try {
            app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, $key, [$audio->id], [$this->input('image', 'different image')]);
            $this->fail('Different retry content accepted');
        } catch (ValidationException) {
            $this->assertSame(2, $report->fresh()->source_version);
            $this->assertDatabaseCount('report_source_changes', 1);
        }
        $foreign->update(['storage_limit_mb' => 0]);
        try {
            app(ChangeEmployeeReport::class)->execute($this->actor($foreignMember), $foreign->id, $other->id, 1, (string) Str::uuid(), [$otherAudio->id], [$this->input('image')]);
            $this->fail('Storage quota bypassed');
        } catch (ValidationException) {
            $this->assertSame(1, $other->fresh()->source_version);
            $this->assertSame([], Storage::disk('reports')->allFiles('.incoming'));
        }
        $snapshot = ReportSourceChange::query()->sole();
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/'.$other->id.'/source-history/'.$snapshot->id)->assertNotFound();
        $this->get('/tenants/'.$foreign->id.'/reports/'.$report->id.'/source-history/'.$snapshot->id)->assertNotFound();
    }

    public function test_retired_image_is_not_valid_current_ai_evidence(): void
    {
        [, $tenant, $member, $report, $audio] = $this->workforce();
        $image = $this->media($report, 'image');
        app(ChangeEmployeeReport::class)->execute($this->actor($member), $tenant->id, $report->id, 1, (string) Str::uuid(), [$audio->id], []);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('unknown_evidence');
        app(ReportPipeline::class)->validate($report->fresh(), 'structured', ['summary' => 'Synthetic source conflict.', 'claims' => [['description' => 'Synthetic observation.', 'evidence_ids' => ['image:'.$image->id], 'quantity' => null, 'quantity_quote' => null, 'completion' => 'unknown', 'completion_quote' => null]], 'uncertainties' => []]);
    }
}
