<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportSourceChange;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class UploadReceiptTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        $owner = User::factory()->create();
        $work = app(ManageWorkforce::class);
        $tenant = $work->createTenant($owner, 'Synthetic receipt tenant');
        $member = $work->addEmployee($owner, $tenant->id, 'Synthetic employee');
        $report = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id,
            'submission_key' => Str::uuid(), 'content_hash' => str_repeat('a', 64), 'source_text' => 'Synthetic private evidence.', 'status' => 'ready'])->fresh();
        $access = app(EmployeeActivation::class);
        $grant = $access->consume($access->issue($owner, $tenant->id, $member->id));

        return [$owner, $tenant, $member, $report, $grant];
    }

    public function test_saved_receipt_is_metadata_only_and_does_not_resubmit_or_reprocess(): void
    {
        [, , , $report, $grant] = $this->fixture();
        $this->withCookie('workforce_device', $grant['token'])->withCredentials()
            ->getJson('/employee/upload-receipt?key='.$report->submission_key)
            ->assertOk()->assertExactJson(['id' => $report->id, 'source_version' => 1, 'status' => 'ready'])
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertDatabaseCount('reports', 1);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame('Synthetic private evidence.', $report->fresh()->source_text);
    }

    public function test_foreign_coworker_missing_withdrawn_and_stale_scope_receipts_are_denied(): void
    {
        [$owner, $tenant, , $report, $grant] = $this->fixture();
        [, , , $foreign] = $this->fixture();
        $coworker = app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic coworker');
        $other = Report::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $coworker->id, 'submission_key' => Str::uuid(), 'content_hash' => str_repeat('b', 64)]);
        $this->withCookie('workforce_device', $grant['token'])->withCredentials();
        foreach ([$foreign->submission_key, $other->submission_key, Str::uuid()] as $key) {
            $this->getJson('/employee/upload-receipt?key='.$key)->assertNotFound();
        }
        $url = '/employee/upload-receipt?key='.$report->submission_key;
        $this->withHeader('X-Employee-Upload-Scope', 'stale:account')->getJson($url)->assertConflict();
        $this->flushHeaders();
        $report->delete();
        $this->getJson($url)->assertNotFound();
        $this->getJson('/employee/upload-receipt?key=invalid')->assertUnprocessable();
    }

    public function test_amendment_receipt_requires_exact_key_report_and_resulting_source_version(): void
    {
        [, $tenant, , $report, $grant] = $this->fixture();
        $key = (string) Str::uuid();
        ReportSourceChange::query()->create(['tenant_id' => $tenant->id, 'report_id' => $report->id, 'source_version' => 1,
            'change_key' => $key, 'request_hash' => str_repeat('c', 64), 'kind' => 'edit', 'review_status' => 'pending', 'media_ids' => [], 'outputs' => []]);
        $report->update(['source_version' => 2, 'status' => 'processing']);
        $url = '/employee/upload-receipt?'.http_build_query(['key' => $key, 'report_id' => $report->id, 'source_version' => 1]);
        $this->withCookie('workforce_device', $grant['token'])->withCredentials()->getJson($url)
            ->assertOk()->assertExactJson(['id' => $report->id, 'source_version' => 2, 'status' => 'processing']);
        $this->getJson('/employee/upload-receipt?key='.$report->submission_key)->assertNotFound();
        $this->getJson(str_replace($key, (string) Str::uuid(), $url))->assertNotFound();
        $report->update(['source_version' => 3]);
        $this->getJson($url)->assertNotFound();
    }

    public function test_revocation_and_missing_authentication_block_receipt_lookup(): void
    {
        [$owner, $tenant, $member, $report, $grant] = $this->fixture();
        $url = '/employee/upload-receipt?key='.$report->submission_key;
        $this->getJson($url)->assertUnauthorized();
        $this->withCookie('workforce_device', $grant['token'])->withCredentials()->getJson($url)->assertOk();
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $member->id);
        $this->getJson($url)->assertRedirect('/employee/connect');
    }
}
