<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Media\MediaInput;
use App\Modules\Media\PreparedMedia;
use App\Modules\Media\PrepareMedia;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ChangeEmployeeReport
{
    public function __construct(private TenantAccess $access, private PrepareMedia $prepare) {}

    /** @param list<int> $keep
     * @param  list<MediaInput>  $inputs
     */
    public function execute(User $actor, int $tenantId, int $reportId, int $version, string $key, array $keep, array $inputs, bool $delete = false): Report
    {
        $member = $this->access->member($actor, $tenantId);
        abort_unless($member->role === 'employee', 403);
        $report = Report::withTrashed()->where('tenant_id', $tenantId)->where('membership_id', $member->id)->findOrFail($reportId);
        $this->valid(Str::isUuid($key) && $version >= 1 && count($keep) <= 4 && count($inputs) <= 4, 'بيانات التعديل غير صالحة.');
        $keep = array_values(array_unique(array_map('intval', $keep)));
        sort($keep);
        $hash = hash('sha256', json_encode([$version, $delete, $keep, array_map(fn (MediaInput $input) => [$input->kind, hash_file('sha256', $input->sourcePath)], $inputs)], JSON_THROW_ON_ERROR));
        if ($this->replayed($tenantId, $reportId, $key, $hash)) {
            return $report;
        }
        $this->editable($report);
        $prepared = [];
        $paths = [];
        try {
            foreach ($inputs as $input) {
                $this->valid(! $delete && in_array($input->kind, ['audio', 'image'], true), 'نوع المرفق غير صالح.');
                $prepared[] = $this->prepare->prepare($input);
                $paths[] = $prepared[array_key_last($prepared)]->path;
            }

            return ReportLocks::make($tenantId, $reportId)->block(2, function () use ($actor, $tenantId, $reportId, $version, $key, $keep, $delete, $hash, $prepared, &$paths) {
                return DB::transaction(function () use ($actor, $tenantId, $reportId, $version, $key, $keep, $delete, $hash, $prepared, &$paths) {
                    $tenant = Tenant::query()->lockForUpdate()->findOrFail($tenantId);
                    $member = $this->access->member($actor, $tenantId);
                    abort_unless($member->role === 'employee', 403);
                    $report = Report::withTrashed()->where('tenant_id', $tenantId)->where('membership_id', $member->id)->lockForUpdate()->findOrFail($reportId);
                    if ($this->replayed($tenantId, $reportId, $key, $hash)) {
                        Storage::disk('reports')->delete($paths);

                        return $report;
                    }
                    $this->editable($report);
                    $this->valid($report->source_version === $version, 'تغيّر التقرير. أعد تحميله قبل التعديل.');
                    $this->valid($delete || $version <= 20, 'وصل التقرير إلى حد التعديلات المسموح خلال الساعة.');
                    $active = ReportMedia::query()->where('tenant_id', $tenantId)->where('report_id', $reportId)->whereNull('retired_at')->get();
                    $retained = $active->whereIn('id', $keep);
                    $this->valid($retained->count() === count($keep), 'مرفق غير متاح ضمن هذا التقرير.');
                    $audioChanged = count(array_filter($prepared, fn (PreparedMedia $media) => $media->kind === 'audio')) > 0;
                    if ($audioChanged) {
                        $retained = $retained->where('kind', '!=', 'audio');
                    }
                    if (! $delete) {
                        $audioCount = $retained->where('kind', 'audio')->count() + count(array_filter($prepared, fn (PreparedMedia $media) => $media->kind === 'audio'));
                        $imageCount = $retained->where('kind', 'image')->count() + count(array_filter($prepared, fn (PreparedMedia $media) => $media->kind === 'image'));
                        $this->valid($audioCount <= 1 && $imageCount <= 3 && ($imageCount === 0 || $audioCount === 1) && ($audioCount + $imageCount > 0 || $report->source_text !== null), 'يلزم تسجيل واحد مع الصور، وبحد أقصى ثلاث صور.');
                        $this->valid($prepared !== [] || $retained->count() !== $active->count(), 'لم يتغير محتوى التقرير.');
                        $bytes = array_sum(array_map(fn (PreparedMedia $media) => $media->bytes, $prepared));
                        $this->valid(ReportMedia::query()->where('tenant_id', $tenantId)->sum('bytes') + $bytes <= $tenant->storage_limit_mb * 1024 * 1024, 'وصلت المؤسسة إلى حد التخزين.');
                    }
                    ReportSourceChange::query()->create([
                        'tenant_id' => $tenantId, 'report_id' => $reportId, 'actor_id' => $actor->id, 'source_version' => $version,
                        'change_key' => $key, 'request_hash' => $hash, 'kind' => $delete ? 'delete' : 'edit',
                        'source_text' => $report->source_text, 'review_status' => $report->review_status,
                        'media_ids' => $active->pluck('id')->all(), 'outputs' => ReportOutput::query()->where('tenant_id', $tenantId)->where('report_id', $reportId)->get()->toArray(),
                    ]);
                    if ($delete) {
                        $report->delete();
                        Audit::record($tenantId, $actor->id, 'report.employee_deleted', 'report', $reportId);

                        return $report;
                    }
                    $retired = $active->whereNotIn('id', $retained->pluck('id')->all());
                    ReportMedia::query()->where('tenant_id', $tenantId)->where('report_id', $reportId)->whereIn('id', $retired->pluck('id'))->update(['retired_at' => now()]);
                    foreach ($prepared as $media) {
                        $path = $tenantId.'/'.$reportId.'/'.basename($media->path);
                        $this->valid(Storage::disk('reports')->move($media->path, $path), 'تعذّر حفظ المرفق.');
                        $paths[] = $path;
                        ReportMedia::query()->create(['tenant_id' => $tenantId, 'report_id' => $reportId, 'path' => $path, 'kind' => $media->kind, 'mime' => $media->mime, 'bytes' => $media->bytes, 'duration' => $media->duration, 'sha256' => $media->sha256]);
                    }
                    $invalid = ['structured'];
                    foreach ($retired as $media) {
                        $invalid[] = ($media->kind === 'audio' ? 'transcript:' : 'image:').$media->id;
                        if ($media->kind === 'audio') {
                            $audioChanged = true;
                        }
                    }
                    if ($audioChanged) {
                        $invalid[] = 'translation';
                    }
                    ReportOutput::query()->where('tenant_id', $tenantId)->where('report_id', $reportId)->whereIn('stage', $invalid)->delete();
                    $report->update(['source_version' => $version + 1, 'version' => $report->version + 1, 'status' => 'submitted', 'review_status' => 'pending', 'failure_code' => null, 'processing_started_at' => null]);
                    Audit::record($tenantId, $actor->id, 'report.employee_edited', 'report', $reportId);
                    event(new ReportSubmitted($tenantId, $reportId, $report->source_version));

                    return $report;
                });
            });
        } catch (Throwable $exception) {
            Storage::disk('reports')->delete($paths);
            if ($exception instanceof LockTimeoutException) {
                throw ValidationException::withMessages(['report' => 'تجري معالجة التقرير الآن. أعد المحاولة بعد قليل.']);
            }
            throw $exception;
        }
    }

    private function editable(Report $report): void
    {
        $this->valid(! $report->trashed() && now()->lt($report->created_at->copy()->addHour()), 'انتهت مهلة التعديل والحذف: ساعة من الإرسال الأصلي.');
    }

    private function replayed(int $tenant, int $report, string $key, string $hash): bool
    {
        $change = ReportSourceChange::query()->where('tenant_id', $tenant)->where('report_id', $report)->where('change_key', $key)->first();
        if ($change) {
            $this->valid(hash_equals((string) $change->getAttribute('request_hash'), $hash), 'استُخدم مفتاح التعديل لمحتوى مختلف.');
        }

        return $change !== null;
    }

    private function valid(bool $valid, string $message): void
    {
        if (! $valid) {
            throw ValidationException::withMessages(['report' => $message]);
        }
    }
}
