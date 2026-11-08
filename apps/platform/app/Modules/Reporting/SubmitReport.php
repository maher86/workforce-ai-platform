<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Media\MediaInput;
use App\Modules\Media\PreparedMedia;
use App\Modules\Media\PrepareMedia;
use App\Modules\WorkManagement\ReportVehicle;
use App\Modules\WorkManagement\WorkItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class SubmitReport
{
    public function __construct(private TenantAccess $access, private PrepareMedia $media) {}

    /** @param list<MediaInput> $inputs */
    public function execute(User $actor, int $tenantId, string $submissionKey, ?string $text, array $inputs, ?int $projectId = null, ?int $taskId = null, ?string $vehiclePlate = null): Report
    {
        $member = $this->access->member($actor, $tenantId);
        $text = trim($text ?? '');
        $this->valid(Str::isUuid($submissionKey) && mb_strlen($text) <= 10000 && ($text !== '' || count($inputs) > 0), 'أضف صوتًا أو صورة أو نصًا.');
        $this->valid(count($inputs) <= 4 && count(array_filter($inputs, fn (MediaInput $input) => $input->kind === 'audio')) <= 1 && count(array_filter($inputs, fn (MediaInput $input) => $input->kind === 'image')) <= 3, 'يمكن إرسال تسجيل واحد وثلاث صور.');
        $hasAudio = count(array_filter($inputs, fn (MediaInput $input) => $input->kind === 'audio')) > 0;
        $hasImages = count(array_filter($inputs, fn (MediaInput $input) => $input->kind === 'image')) > 0;
        $this->valid(! $hasImages || $hasAudio, 'أضف تسجيلًا صوتيًا مع الصور. الصور مرفقات اختيارية ولا تُرسل وحدها.');
        $sourceHashes = array_map(fn (MediaInput $input) => [$input->kind, hash_file('sha256', $input->sourcePath)], $inputs);
        $identity = [$text, $sourceHashes, $projectId, $taskId];
        $plateKey = ReportVehicle::key($vehiclePlate);
        if ($plateKey !== null) {
            $identity[] = $plateKey;
        }
        $hash = hash('sha256', json_encode($identity, JSON_THROW_ON_ERROR));
        $existing = Report::withTrashed()->where('tenant_id', $tenantId)->where('membership_id', $member->id)->where('submission_key', $submissionKey)->first();
        if ($existing) {
            $this->valid(! $existing->trashed(), 'هذا التقرير محذوف. أرسل تقريرًا جديدًا بمفتاح جديد.');
            $this->valid(hash_equals($existing->content_hash, $hash), 'استُخدم مفتاح الإرسال لمحتوى مختلف.');

            return $existing;
        }
        $prepared = [];
        $paths = [];
        try {
            foreach ($inputs as $input) {
                $prepared[] = $this->media->prepare($input);
                $paths[] = $prepared[array_key_last($prepared)]->path;
            }

            return DB::transaction(function () use ($actor, $tenantId, $submissionKey, $text, $hash, $projectId, $taskId, $prepared, $vehiclePlate, &$paths) {
                $tenant = Tenant::query()->lockForUpdate()->findOrFail($tenantId);
                $member = $this->access->member($actor, $tenantId);
                $existing = Report::withTrashed()->where('tenant_id', $tenantId)->where('membership_id', $member->id)->where('submission_key', $submissionKey)->first();
                if ($existing) {
                    $this->valid(! $existing->trashed(), 'هذا التقرير محذوف. أرسل تقريرًا جديدًا بمفتاح جديد.');
                    $this->valid(hash_equals($existing->content_hash, $hash), 'استُخدم مفتاح الإرسال لمحتوى مختلف.');
                    Storage::disk('reports')->delete($paths);

                    return $existing;
                }
                $this->valid(Report::withTrashed()->where('tenant_id', $tenantId)->where('created_at', '>=', now()->startOfDay())->count() < $tenant->daily_report_limit, 'وصلت المؤسسة إلى حد التقارير اليومي.');
                $bytes = array_sum(array_map(fn (PreparedMedia $media) => $media->bytes, $prepared));
                $this->valid(ReportMedia::query()->where('tenant_id', $tenantId)->sum('bytes') + $bytes <= $tenant->storage_limit_mb * 1024 * 1024, 'وصلت المؤسسة إلى حد التخزين.');
                $projectId = $this->validateWork($tenantId, $projectId, $taskId);
                $report = Report::query()->create([
                    'tenant_id' => $tenantId, 'membership_id' => $member->id, 'submission_key' => $submissionKey,
                    'content_hash' => $hash, 'source_text' => $text ?: null, 'project_id' => $projectId, 'task_id' => $taskId,
                    'vehicle_id' => ReportVehicle::resolve($tenantId, $vehiclePlate),
                ]);
                foreach ($prepared as $media) {
                    $path = $tenantId.'/'.$report->id.'/'.basename($media->path);
                    Storage::disk('reports')->move($media->path, $path);
                    $paths[] = $path;
                    ReportMedia::query()->create([
                        'tenant_id' => $tenantId, 'report_id' => $report->id, 'path' => $path,
                        'kind' => $media->kind, 'mime' => $media->mime, 'bytes' => $media->bytes,
                        'duration' => $media->duration, 'sha256' => $media->sha256,
                    ]);
                }
                Audit::record($tenantId, $actor->id, 'report.submitted', 'report', $report->id);
                event(new ReportSubmitted($tenantId, $report->id));

                return $report;
            });
        } catch (Throwable $exception) {
            Storage::disk('reports')->delete($paths);
            throw $exception;
        }
    }

    public function validateWork(int $tenantId, ?int $projectId, ?int $taskId): ?int
    {
        if ($projectId !== null) {
            WorkItem::query()->where('tenant_id', $tenantId)->where('kind', 'project')->where('active', true)->findOrFail($projectId);
        }
        if ($taskId !== null) {
            $task = WorkItem::query()->where('tenant_id', $tenantId)->where('kind', 'task')->where('active', true)->findOrFail($taskId);
            if ($task->project_id !== null) {
                WorkItem::query()->where('tenant_id', $tenantId)->where('kind', 'project')->where('active', true)->findOrFail($task->project_id);
            }
            $this->valid($projectId === null || $task->project_id === null || $task->project_id === $projectId, 'المهمة لا تتبع المشروع المحدد.');
            $projectId ??= $task->project_id;
        }

        return $projectId;
    }

    private function valid(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['report' => $message]);
        }
    }
}
