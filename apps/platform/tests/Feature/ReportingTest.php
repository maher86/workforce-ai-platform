<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\AIProcessing\DemoReportAI;
use App\Modules\AIProcessing\OpenAIReportAI;
use App\Modules\AIProcessing\ProcessReport;
use App\Modules\AIProcessing\ReportPipeline;
use App\Modules\AIProcessing\StageResult;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Media\MediaInput;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportAccess;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\ReviewReport;
use App\Modules\Reporting\SubmitReport;
use App\Modules\WorkManagement\WorkItem;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ReportingTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<string> */
    private array $temporary = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Storage::fake('reports');
        Queue::fake();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        foreach ($this->temporary as $path) {
            @unlink($path);
        }
        parent::tearDown();
    }

    /** @return array{User, Tenant, Membership, User} */
    private function workforce(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic reporting workspace');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic reporter');

        return [$owner, $tenant, $member, User::query()->findOrFail($member->user_id)];
    }

    private function submit(User $employee, Tenant $tenant, string $text = 'I inspected the site.'): Report
    {
        return app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), $text, []);
    }

    private function mediaFile(string $kind, float $seconds = 1): string
    {
        $path = sys_get_temp_dir().'/workforce-'.Str::uuid().($kind === 'image' ? '.png' : '.wav');
        $this->temporary[] = $path;
        $args = $kind === 'image'
            ? ['-f', 'lavfi', '-i', 'color=c=blue:s=32x32', '-frames:v', '1', '-threads', '1']
            : ['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', (string) $seconds, '-c:a', 'pcm_s16le'];
        (new Process(['ffmpeg', '-v', 'error', '-nostdin', ...$args, '-y', $path]))->setTimeout(20)->mustRun();

        return $path;
    }

    public function test_text_report_without_project_or_task_is_immutable_and_idempotent(): void
    {
        [, $tenant, $member, $employee] = $this->workforce();
        $key = (string) Str::uuid();
        $service = app(SubmitReport::class);
        $first = $service->execute($employee, $tenant->id, $key, '  Site inspected  ', []);
        $second = $service->execute($employee, $tenant->id, $key, 'Site inspected', []);
        $this->assertSame($first->id, $second->id);
        $this->assertSame($member->id, $first->membership_id);
        $this->assertNull($first->task_id);
        $this->assertNull($first->project_id);
        $this->assertDatabaseCount('reports', 1);
        $this->assertDatabaseHas('audit_entries', ['tenant_id' => $tenant->id, 'action' => 'report.submitted']);
        $this->expectException(ValidationException::class);
        $service->execute($employee, $tenant->id, $key, 'Different content', []);
    }

    public function test_empty_and_excess_media_submissions_are_rejected(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        try {
            app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, []);
            $this->fail('Empty report accepted');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reports', 0);
        }
        $file = $this->mediaFile('audio');
        $this->expectException(ValidationException::class);
        app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($file, 'audio'), new MediaInput($file, 'audio')]);
    }

    public function test_audio_images_and_text_are_normalized_privately_and_not_public(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        $image = $this->mediaFile('image');
        $audio = $this->mediaFile('audio');
        $report = app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), 'Supporting text', [new MediaInput($audio, 'audio'), new MediaInput($image, 'image')]);
        $items = ReportMedia::query()->where('report_id', $report->id)->get();
        $this->assertCount(2, $items);
        foreach ($items as $item) {
            $this->assertStringStartsWith($tenant->id.'/'.$report->id.'/', $item->path);
            Storage::disk('reports')->assertExists($item->path);
            $this->assertArrayNotHasKey('path', $item->toArray());
            $this->assertSame($item->kind === 'image' ? 'image/jpeg' : 'audio/mp4', $item->mime);
            $this->assertSame($item->sha256, hash_file('sha256', Storage::disk('reports')->path($item->path)));
        }
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/'.$report->id.'/media/'.$items[0]->id)
            ->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Cache-Control', 'no-store, private');
        $this->get('/storage/'.$items[0]->path)->assertNotFound();
    }

    public function test_svg_disguised_as_jpeg_and_long_audio_are_rejected_without_orphans(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        $path = tempnam(sys_get_temp_dir(), 'workforce-bad-');
        $this->temporary[] = $path;
        file_put_contents($path, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
        try {
            app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($this->mediaFile('audio'), 'audio'), new MediaInput($path, 'image')]);
            $this->fail('SVG accepted');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reports', 0);
            $this->assertSame([], Storage::disk('reports')->allFiles());
        }
        $long = $this->mediaFile('audio', 181);
        $this->expectException(ValidationException::class);
        app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($long, 'audio')]);
    }

    public function test_tenant_daily_and_storage_limits_are_enforced(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        $tenant->update(['daily_report_limit' => 1]);
        $this->submit($employee, $tenant);
        try {
            $this->submit($employee, $tenant);
            $this->fail('Daily quota bypassed');
        } catch (ValidationException) {
            $this->assertDatabaseCount('reports', 1);
        }
        $tenant->update(['daily_report_limit' => 10, 'storage_limit_mb' => 0]);
        $this->expectException(ValidationException::class);
        app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($this->mediaFile('audio'), 'audio')]);
    }

    public function test_browser_streaming_webm_without_duration_header_is_supported(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        $path = sys_get_temp_dir().'/workforce-'.Str::uuid().'.webm';
        $this->temporary[] = $path;
        $process = new Process(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '1', '-c:a', 'libopus', '-f', 'webm', 'pipe:1']);
        $process->setTimeout(15)->mustRun();
        file_put_contents($path, $process->getOutput());
        app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($path, 'audio')]);
        $this->assertDatabaseCount('reports', 1);
        $this->assertSame('audio/mp4', ReportMedia::query()->sole()->mime);
    }

    public function test_old_orphan_cleanup_preserves_referenced_and_recent_media(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        $report = app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($this->mediaFile('audio'), 'audio')]);
        $media = ReportMedia::query()->where('report_id', $report->id)->sole();
        $orphan = '.incoming/'.Str::uuid().'.jpg';
        $recent = '.incoming/'.Str::uuid().'.jpg';
        Storage::disk('reports')->put($orphan, 'synthetic orphan');
        Storage::disk('reports')->put($recent, 'synthetic recent');
        touch(Storage::disk('reports')->path($orphan), now()->subDays(2)->getTimestamp());
        touch(Storage::disk('reports')->path($media->path), now()->subDays(2)->getTimestamp());
        $this->artisan('reports:prune-orphans', ['--apply' => true])->assertSuccessful();
        Storage::disk('reports')->assertMissing($orphan);
        Storage::disk('reports')->assertExists($media->path);
        Storage::disk('reports')->assertExists($recent);
    }

    public function test_foreign_and_inactive_members_cannot_submit_or_read_reports(): void
    {
        [, $tenant, $member, $employee] = $this->workforce();
        [, $foreign, , $other] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        $this->actingAs($other)->get('/tenants/'.$tenant->id.'/reports')->assertRedirect('/employee/connect');
        try {
            app(ReportAccess::class)->view($other, $foreign->id, $report->id);
            $this->fail('Foreign report read');
        } catch (ModelNotFoundException) {
            $this->assertTrue(true);
        }
        $member->update(['active' => false]);
        $this->expectException(ModelNotFoundException::class);
        $this->submit($employee, $tenant);
    }

    public function test_employee_cannot_read_a_coworker_report_within_same_tenant(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        $otherMember = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Other synthetic employee');
        $other = User::query()->findOrFail($otherMember->user_id);
        $report = $this->submit($employee, $tenant);
        $this->expectException(ModelNotFoundException::class);
        app(ReportAccess::class)->view($other, $tenant->id, $report->id);
    }

    public function test_employee_http_submit_ignores_forged_tenant_and_private_media_is_scoped(): void
    {
        [$owner, $tenant, $member] = $this->workforce();
        [, $foreign] = $this->workforce();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $member->id));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertOk();
        $image = new UploadedFile($this->mediaFile('image'), 'untrusted-name.png', 'image/png', null, true);
        $response = $this->post('/employee/reports', ['submission_key' => (string) Str::uuid(), 'tenant_id' => $foreign->id, 'audio' => new UploadedFile($this->mediaFile('audio'), 'voice.wav', 'audio/wav', null, true), 'images' => [$image]], ['Accept' => 'application/json']);
        $response->assertCreated();
        $report = Report::query()->sole();
        $this->assertSame($tenant->id, $report->tenant_id);
        $attachment = ReportMedia::query()->where('kind', 'image')->sole();
        $this->get('/employee/reports/'.$report->id.'/media/'.$attachment->id)->assertOk();
        $this->get('/employee/reports/'.($report->id + 100).'/media/'.$attachment->id)->assertNotFound();
    }

    public function test_manager_lists_exports_reviews_and_files_do_not_cross_tenants(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        [, $foreign, , $other] = $this->workforce();
        $report = $this->submit($other, $foreign);
        $own = $this->submit($employee, $tenant);
        $this->actingAs($owner)->get('/tenants/'.$foreign->id.'/reports')->assertNotFound();
        $this->get('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertNotFound();
        $this->post('/tenants/'.$tenant->id.'/reports/'.$report->id.'/retry')->assertNotFound();
        $this->post('/tenants/'.$tenant->id.'/reports/'.$report->id.'/review', ['version' => 1, 'english_report' => 'Review', 'reason' => 'Evidence checked', 'status' => 'approved'])->assertNotFound();
        $csv = $this->get('/tenants/'.$tenant->id.'/reports/export')->assertOk()->streamedContent();
        $this->assertStringContainsString((string) $own->id, $csv);
        $this->assertStringNotContainsString('Other tenant private note', $csv);
    }

    public function test_optional_work_associations_reject_foreign_project_and_wrong_parent(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        [, $foreign] = $this->workforce();
        $foreignProject = WorkItem::query()->create(['tenant_id' => $foreign->id, 'kind' => 'project', 'name' => 'Foreign']);
        try {
            app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), 'Note', [], $foreignProject->id);
            $this->fail('Foreign project linked');
        } catch (ModelNotFoundException) {
            $this->assertDatabaseCount('reports', 0);
        }
        $a = WorkItem::query()->create(['tenant_id' => $tenant->id, 'kind' => 'project', 'name' => 'A']);
        $b = WorkItem::query()->create(['tenant_id' => $tenant->id, 'kind' => 'project', 'name' => 'B']);
        $task = WorkItem::query()->create(['tenant_id' => $tenant->id, 'kind' => 'task', 'name' => 'Task', 'project_id' => $a->id]);
        $this->expectException(ValidationException::class);
        app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), 'Note', [], $b->id, $task->id);
    }

    public function test_demo_pipeline_persists_stages_and_duplicate_jobs_do_not_repeat_them(): void
    {
        config(['workforce.report_analysis' => 'full']);
        [, $tenant, , $employee] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        $job = new ProcessReport($tenant->id, $report->id);
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $job->handle(app(ReportPipeline::class), new DemoReportAI);
        }
        $this->assertSame('ready', $report->fresh()->status);
        $this->assertDatabaseCount('report_outputs', 2);
        $this->assertSame([], ReportOutput::query()->where('stage', 'structured')->sole()->payload['claims']);
        $this->assertDatabaseHas('audit_entries', ['tenant_id' => $tenant->id, 'action' => 'report.ready']);
    }

    public function test_forged_job_tenant_and_disabled_member_never_process_evidence(): void
    {
        [, $tenant, $member, $employee] = $this->workforce();
        [, $foreign] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        (new ProcessReport($foreign->id, $report->id))->handle(app(ReportPipeline::class), new DemoReportAI);
        $this->assertDatabaseCount('report_outputs', 0);
        $member->update(['active' => false]);
        (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), new DemoReportAI);
        $this->assertSame('membership_inactive', $report->fresh()->failure_code);
        $this->assertDatabaseCount('report_outputs', 0);
    }

    public function test_stage_failure_is_redacted_and_failed_job_is_tenant_scoped(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        [, $foreign] = $this->workforce();
        $report = $this->submit($employee, $tenant, 'Sensitive synthetic evidence');
        $ai = new class extends DemoReportAI
        {
            public function run(string $stage, array $context): StageResult
            {
                throw new RuntimeException('Sensitive synthetic evidence');
            }
        };
        $job = new ProcessReport($tenant->id, $report->id);
        try {
            $job->handle(app(ReportPipeline::class), $ai);
            $this->fail('Stage should fail');
        } catch (RuntimeException $error) {
            $this->assertSame('report_stage_failed', $error->getMessage());
            $this->assertNull($error->getPrevious());
        }
        (new ProcessReport($foreign->id, $report->id))->failed(null);
        $this->assertSame('processing', $report->fresh()->status);
        $job->failed(null);
        $this->assertSame('failed', $report->fresh()->status);
    }

    public function test_review_preserves_generated_output_and_rejects_stale_versions(): void
    {
        config(['workforce.report_analysis' => 'full']);
        [$owner, $tenant, , $employee] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        for ($i = 0; $i < 3; $i++) {
            (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), new DemoReportAI);
        }
        $before = ReportOutput::query()->where('stage', 'structured')->sole()->payload;
        app(ReviewReport::class)->execute($owner, $tenant->id, $report->id, 1, 'Human reviewed report', 'Compared with source recording.', 'approved');
        $this->assertSame(2, $report->fresh()->version);
        $this->assertSame($before, ReportOutput::query()->where('stage', 'structured')->sole()->payload);
        $this->assertDatabaseCount('report_revisions', 1);
        $this->expectException(ValidationException::class);
        app(ReviewReport::class)->execute($owner, $tenant->id, $report->id, 1, 'Stale', 'Stale edit', 'approved');
    }

    public function test_export_neutralizes_spreadsheet_formula_and_filters_tenant_content(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        [, $foreign, , $other] = $this->workforce();
        $this->submit($employee, $tenant, "\t=HYPERLINK(\"https://example.test\")");
        $this->submit($other, $foreign, 'Other tenant private note');
        $csv = $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/export')->assertOk()->streamedContent();
        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->assertStringNotContainsString('Other tenant private note', $csv);
    }

    public function test_human_fallback_preserves_ai_failure_and_retry_requires_new_review(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        $report->update(['status' => 'failed', 'failure_code' => 'processing_failed']);
        app(ReviewReport::class)->execute($owner, $tenant->id, $report->id, 1, 'Manually reviewed English report.', 'Listened to original source after AI failure.', 'approved');
        $this->assertSame('failed', $report->fresh()->status);
        $this->assertSame('approved', $report->fresh()->review_status);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/reports/'.$report->id.'/retry')->assertRedirect();
        $this->assertSame('pending', $report->fresh()->review_status);
        $this->assertDatabaseCount('report_revisions', 1);
    }

    public function test_database_exception_logging_does_not_include_evidence_bindings(): void
    {
        Log::spy();
        report(new QueryException('pgsql', 'INSERT synthetic', ['synthetic private source text'], new \PDOException('synthetic database failure', 23505)));
        Log::shouldHaveReceived('error')->once()->with('database_operation_failed', ['sqlstate' => '23505']);
    }

    public function test_retention_dry_run_and_apply_delete_private_media_and_outputs(): void
    {
        [, $tenant, , $employee] = $this->workforce();
        $report = app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [new MediaInput($this->mediaFile('audio'), 'audio')]);
        $media = ReportMedia::query()->sole();
        $report->update(['created_at' => now()->subDays(91)]);
        $this->artisan('reports:purge')->assertSuccessful();
        $this->assertDatabaseCount('reports', 1);
        $this->artisan('reports:purge', ['--apply' => true])->assertSuccessful();
        $this->assertDatabaseCount('reports', 0);
        $this->assertDatabaseCount('report_media', 0);
        Storage::disk('reports')->assertMissing($media->path);
    }

    public function test_manual_delete_requires_owner_and_is_tenant_scoped(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        $report = $this->submit($employee, $tenant);
        $manager = User::factory()->create();
        Membership::query()->create(['tenant_id' => $tenant->id, 'user_id' => $manager->id, 'role' => 'manager']);
        $this->actingAs($manager)->delete('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertForbidden();
        $this->actingAs($owner)->delete('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertRedirect('/tenants/'.$tenant->id.'/reports');
        $this->assertDatabaseMissing('reports', ['id' => $report->id]);
    }

    public function test_recovery_enqueues_only_stale_reports_and_retry_is_guarded(): void
    {
        [$owner, $tenant, , $employee] = $this->workforce();
        $old = $this->submit($employee, $tenant);
        $fresh = $this->submit($employee, $tenant);
        $old->update(['updated_at' => now()->subMinutes(10)]);
        Queue::fake(); // Observe recovery, separately from the original submit dispatch.
        Cache::store('redis')->forget('workforce:'.app()->environment().':tenant:'.$tenant->id.':recover:'.$old->id);
        $this->artisan('reports:recover')->assertSuccessful();
        Queue::assertPushed(ProcessReport::class, fn (ProcessReport $job) => $job->reportId === $old->id && $job->tenantId === $tenant->id);
        Queue::assertNotPushed(ProcessReport::class, fn (ProcessReport $job) => $job->reportId === $fresh->id);
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/reports/'.$fresh->id.'/retry')->assertStatus(409);
        $old->update(['status' => 'failed']);
        $this->post('/tenants/'.$tenant->id.'/reports/'.$old->id.'/retry')->assertRedirect();
        $this->assertSame('submitted', $old->fresh()->status);
    }

    public function test_openai_adapter_handles_structured_output_without_real_network(): void
    {
        config(['workforce.openai_key' => 'synthetic-test-key']);
        Http::fake(['api.openai.com/v1/responses' => Http::response(['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => '{"english":"Three panels were installed.","uncertainties":[]}']]]], 'usage' => ['total_tokens' => 20]])]);
        $result = (new OpenAIReportAI)->run('translation', ['data' => ['sources' => ['text' => 'تم تركيب ثلاث لوحات.']]]);
        $this->assertSame('Three panels were installed.', $result->payload['english']);
        Http::assertSent(fn ($request) => $request['store'] === false && $request['text']['format']['strict'] === true && ! isset($request['tools']));
    }

    public function test_translation_uses_minimal_reasoning_only_for_the_compatible_model(): void
    {
        config(['workforce.openai_key' => 'synthetic-test-key', 'workforce.translation_effort' => 'minimal']);
        Http::fake(['api.openai.com/v1/responses' => Http::response(['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => '{"english":"Work is not finished.","uncertainties":[]}']]]]])]);
        config(['workforce.report_model' => 'gpt-5-mini']);
        (new OpenAIReportAI)->run('translation', ['data' => ['sources' => ['text' => 'Synthetic source.']]]);
        Http::assertSent(fn ($request) => $request['reasoning']['effort'] === 'minimal' && $request['store'] === false && str_contains($request['instructions'], 'no introductions'));
        Http::fake(['api.openai.com/v1/responses' => Http::response(['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => '{"english":"Work is not finished.","uncertainties":[]}']]]]])]);
        config(['workforce.report_model' => 'gpt-4.1-mini']);
        (new OpenAIReportAI)->run('translation', ['data' => ['sources' => ['text' => 'Synthetic source.']]]);
        Http::assertSent(fn ($request) => ! isset($request['reasoning']));
    }

    public function test_openai_transcription_preserves_source_language_and_upload_contract(): void
    {
        config(['workforce.openai_key' => 'synthetic-test-key']);
        Http::fake(function ($request) {
            $body = $request->body();
            $this->assertStringContainsString('name="model"', $body);
            $this->assertStringContainsString((string) config('workforce.transcription_model'), $body);
            $this->assertStringContainsString('name="response_format"', $body);

            return Http::response(['text' => 'ركبت ثلاثة ألواح فقط.', 'usage' => ['input_tokens' => 10]]);
        });
        $path = tempnam(sys_get_temp_dir(), 'workforce-synthetic-audio-');
        $this->temporary[] = $path;
        file_put_contents($path, 'synthetic transport fixture; not real employee audio');
        $result = (new OpenAIReportAI)->run('transcript', ['path' => $path]);
        $this->assertSame('ركبت ثلاثة ألواح فقط.', $result->payload['text']);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.openai.com/v1/audio/transcriptions');
    }

    public function test_openai_image_input_is_inline_and_paths_do_not_leave_server(): void
    {
        config(['workforce.openai_key' => 'synthetic-test-key']);
        Http::fake(['api.openai.com/v1/responses' => Http::response(['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => '{"observations":["A blue surface is visible."],"uncertainties":["No quantity or completion can be established."]}']]]]])]);
        $path = tempnam(sys_get_temp_dir(), 'workforce-synthetic-image-');
        $this->temporary[] = $path;
        file_put_contents($path, 'synthetic image transport fixture');
        $result = (new OpenAIReportAI)->run('image', ['path' => $path, 'data' => ['source_id' => 'image:synthetic']]);
        $this->assertCount(1, $result->payload['observations']);
        Http::assertSent(fn ($request) => str_starts_with($request['input'][0]['content'][1]['image_url'], 'data:image/jpeg;base64,') && ! str_contains($request['input'][0]['content'][0]['text'], $path) && $request['store'] === false);
    }
}
