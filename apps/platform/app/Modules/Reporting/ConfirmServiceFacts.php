<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\TenantAccess;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ConfirmServiceFacts
{
    public function __construct(private TenantAccess $access) {}

    /** @param array<string, mixed> $input */
    public function execute(User $actor, int $tenant, int $report, array $input): void
    {
        $this->access->manageTeam($actor, $tenant);
        $data = Validator::make($input, [
            'version' => 'required|integer|min:0',
            'source_version' => 'required|integer|min:1',
            'service_type' => 'nullable|string|max:100',
            'started_at' => 'nullable|required_with:ended_at|date_format:Y-m-d\TH:i',
            'ended_at' => 'nullable|required_with:started_at|date_format:Y-m-d\TH:i|after:started_at',
            'rework' => 'nullable|boolean',
            'rework_reason' => 'nullable|string|max:2000',
            'confirmation_note' => 'required|string|max:2000',
        ])->validate();
        $rework = isset($data['rework']) ? (bool) $data['rework'] : null;
        $reason = $rework === true ? trim((string) ($data['rework_reason'] ?? '')) : null;
        if ($reason === '' || trim($data['confirmation_note']) === '') {
            throw ValidationException::withMessages(['confirmation_note' => 'دوّن مصدر التأكيد، وسبب إعادة العمل عند اختيار نعم.']);
        }
        $start = ! empty($data['started_at']) ? CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['started_at'], ReportActivity::ZONE)->utc() : null;
        $end = ! empty($data['ended_at']) ? CarbonImmutable::createFromFormat('!Y-m-d\TH:i', $data['ended_at'], ReportActivity::ZONE)->utc() : null;
        if ($end !== null && $end->isFuture()) {
            throw ValidationException::withMessages(['ended_at' => 'لا تسجّل وقتًا مستقبليًا كعمل موثّق.']);
        }
        DB::transaction(function () use ($actor, $tenant, $report, $data, $rework, $reason, $start, $end) {
            $this->access->manageTeam($actor, $tenant);
            $current = Report::query()->where('tenant_id', $tenant)->lockForUpdate()->findOrFail($report);
            if ($current->source_version !== (int) $data['source_version']) {
                throw ValidationException::withMessages(['source_version' => 'تغيّرت مصادر التقرير. أعد تحميل الصفحة ثم راجعها قبل التأكيد.']);
            }
            $version = (int) ReportServiceFact::query()->where('tenant_id', $tenant)->where('report_id', $report)->max('version');
            if ($version !== (int) $data['version']) {
                throw ValidationException::withMessages(['version' => 'حُفظ إصدار أحدث. أعد تحميل الصفحة قبل التعديل.']);
            }
            ReportServiceFact::query()->create([
                'tenant_id' => $tenant, 'report_id' => $report, 'actor_id' => $actor->id, 'source_version' => $current->source_version, 'version' => $version + 1,
                'service_type' => trim((string) ($data['service_type'] ?? '')) ?: null,
                'started_at' => $start, 'ended_at' => $end, 'rework' => $rework,
                'rework_reason' => $reason, 'confirmation_note' => trim($data['confirmation_note']),
            ]);
            Audit::record($tenant, $actor->id, 'report.service_facts_confirmed', 'report', $report);
        });
    }
}
