<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\AIProcessing\DemoReportAI;
use App\Modules\AIProcessing\ProcessReport;
use App\Modules\AIProcessing\ReportAI;
use App\Modules\AIProcessing\ReportPipeline;
use App\Modules\AIProcessing\StageResult;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Media\MediaInput;
use App\Modules\Media\PreparedMedia;
use App\Modules\Media\PrepareMedia;
use App\Modules\Reporting\ChangeEmployeeReport;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class TextReportingTest extends TestCase
{
    use RefreshDatabase;

    /** @var list<UploadedFile> */
    private array $uploads = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        Queue::fake();
        Http::preventStrayRequests();
        Storage::fake('reports');
        config(['workforce.report_analysis' => 'text']);
        $prepare = Mockery::mock(PrepareMedia::class);
        $prepare->shouldReceive('prepare')->andReturnUsing(function (MediaInput $input) {
            $path = '.incoming/'.Str::uuid();
            Storage::disk('reports')->put($path, 'synthetic prepared evidence');

            return new PreparedMedia($path, $input->kind, $input->kind === 'audio' ? 'audio/mp4' : 'image/jpeg', 100, hash_file('sha256', $input->sourcePath), $input->kind === 'audio' ? 5.0 : null);
        });
        $this->app->instance(PrepareMedia::class, $prepare);
    }

    private function input(string $kind): MediaInput
    {
        $file = UploadedFile::fake()->createWithContent('synthetic-'.$kind.'.bin', 'synthetic '.$kind);
        $this->uploads[] = $file;

        return new MediaInput($file->getPathname(), $kind);
    }

    private function fixture(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic text workspace');
        $member = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $employee = User::query()->findOrFail($member->user_id);
        $report = app(SubmitReport::class)->execute($employee, $tenant->id, (string) Str::uuid(), null, [$this->input('audio'), $this->input('image')]);

        return [$owner, $tenant, $member, $employee, $report];
    }

    private function ai(): ReportAI
    {
        return new class implements ReportAI
        {
            public array $stages = [];

            public function run(string $stage, array $context): StageResult
            {
                $this->stages[] = $stage;
                $payload = match ($stage) {
                    'transcript' => ['text' => 'ركبت ثلاثة فلاتر ولم أكمل إصلاح الفرامل.', 'language' => 'ar'],
                    'translation' => ['english' => 'I installed three filters and did not finish repairing the brakes.', 'uncertainties' => []],
                    default => throw new \RuntimeException('Unexpected analysis stage'),
                };

                return new StageResult($payload, 'synthetic', [], 'demo');
            }
        };
    }

    public function test_voice_with_optional_image_uses_only_transcription_and_translation(): void
    {
        [, $tenant, , , $report] = $this->fixture();
        $ai = $this->ai();
        for ($i = 0; $i < 5; $i++) {
            (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), $ai);
        }
        $this->assertSame('text', $report->fresh()->analysis_mode);
        $this->assertSame('ready', $report->fresh()->status);
        $this->assertSame(['transcript', 'translation'], $ai->stages);
        $this->assertDatabaseCount('report_outputs', 2);
        $this->assertDatabaseCount('report_media', 2);
        $this->assertArrayHasKey('stage_duration_ms', ReportOutput::query()->firstOrFail()->usage);
        Queue::assertPushed(ProcessReport::class, fn ($job) => $job->queue === ProcessReport::TEXT_QUEUE && $job->tenantId === $tenant->id);
    }

    public function test_image_edit_keeps_mode_and_reuses_text_without_provider_calls(): void
    {
        [, $tenant, , $employee, $report] = $this->fixture();
        $ai = $this->ai();
        for ($i = 0; $i < 3; $i++) {
            (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), $ai);
        }
        config(['workforce.report_analysis' => 'full']);
        $keep = ReportMedia::query()->where('report_id', $report->id)->pluck('id')->all();
        $edited = app(ChangeEmployeeReport::class)->execute($employee, $tenant->id, $report->id, 1, (string) Str::uuid(), $keep, [$this->input('image')]);
        (new ProcessReport($tenant->id, $report->id, $edited->source_version))->handle(app(ReportPipeline::class), $ai);
        $this->assertSame('text', $edited->fresh()->analysis_mode);
        $this->assertSame('ready', $edited->fresh()->status);
        $this->assertSame(['transcript', 'translation'], $ai->stages);
        $this->assertDatabaseCount('report_outputs', 2);
        (new ProcessReport($tenant->id, $report->id, 1))->failed(null);
        $this->assertSame('ready', $edited->fresh()->status);
    }

    public function test_original_and_english_are_private_and_internal_explanations_are_not_in_read_payload(): void
    {
        [$owner, $tenant, $member, , $report] = $this->fixture();
        for ($i = 0; $i < 3; $i++) {
            (new ProcessReport($tenant->id, $report->id))->handle(app(ReportPipeline::class), $this->ai());
        }
        ReportOutput::query()->create(['tenant_id' => $tenant->id, 'report_id' => $report->id, 'stage' => 'structured', 'provider' => 'demo', 'model' => 'synthetic', 'prompt_version' => '1', 'schema_version' => '2', 'payload' => ['summary' => 'Historical internal explanation.']]);
        $activation = app(EmployeeActivation::class);
        $device = $activation->consume($activation->issue($owner, $tenant->id, $member->id));
        $this->withCookie('workforce_device', $device['token'])->get('/employee/reports/'.$report->id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('textOutputs', 2)->where('textOutputs.0.payload.text', 'ركبت ثلاثة فلاتر ولم أكمل إصلاح الفرامل.')
                ->where('textOutputs.1.payload.english', 'I installed three filters and did not finish repairing the brakes.')->missing('outputs'));
        $other = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        $foreignReport = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $other->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('b', 64)]);
        $this->get('/employee/reports/'.$foreignReport->id)->assertNotFound();
        $this->actingAs($owner)->get('/tenants/'.$tenant->id.'/reports/'.$report->id)->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('outputs', 2)->where('outputs.1.stage', 'translation'));
        $csv = $this->get('/tenants/'.$tenant->id.'/reports/export')->assertOk()->streamedContent();
        $this->assertStringContainsString('ركبت ثلاثة فلاتر ولم أكمل إصلاح الفرامل.', $csv);
        $this->assertStringContainsString('I installed three filters and did not finish repairing the brakes.', $csv);
        $this->assertDatabaseHas('report_outputs', ['report_id' => $report->id, 'stage' => 'structured']);
    }

    public function test_historical_full_mode_and_text_idempotency_survive_configuration_changes(): void
    {
        [, $tenant, , $employee, $report] = $this->fixture();
        $historical = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $report->membership_id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('c', 64), 'source_text' => 'Synthetic historical report.']);
        for ($i = 0; $i < 3; $i++) {
            (new ProcessReport($tenant->id, $historical->id))->handle(app(ReportPipeline::class), new DemoReportAI);
        }
        $this->assertSame('full', $historical->fresh()->analysis_mode);
        $this->assertDatabaseHas('report_outputs', ['report_id' => $historical->id, 'stage' => 'structured']);
        $key = (string) Str::uuid();
        $plain = app(SubmitReport::class)->execute($employee, $tenant->id, $key, 'Synthetic text.', []);
        config(['workforce.report_analysis' => 'full']);
        $replayed = app(SubmitReport::class)->execute($employee, $tenant->id, $key, 'Synthetic text.', []);
        $this->assertSame($plain->id, $replayed->id);
        $this->assertSame('text', $replayed->analysis_mode);
    }
}
