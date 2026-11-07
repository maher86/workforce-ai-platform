<?php

namespace App\Modules\WorkManagement;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Reporting\Report;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReportVehicle
{
    public static function key(?string $plate): ?string
    {
        $plate = trim($plate ?? '');
        if ($plate === '') {
            return null;
        }
        Validator::make(['vehicle_plate' => $plate], ['vehicle_plate' => 'string|max:80'])->validate();
        $plate = strtr($plate, ['٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9', '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
        $key = mb_strtoupper((string) preg_replace('/[^\p{L}\p{N}]/u', '', $plate));
        Validator::make(['vehicle_plate' => $key], ['vehicle_plate' => 'required|string|max:80'])->validate();

        return $key;
    }

    public static function resolve(int $tenantId, ?string $plate): ?int
    {
        $key = self::key($plate);
        if ($key === null) {
            return null;
        }

        // Callers serialize on the tenant before creating a plate.
        return Vehicle::query()->firstOrCreate(['tenant_id' => $tenantId, 'plate_key' => $key], ['plate' => mb_strtoupper(trim((string) $plate))])->id;
    }

    public function assign(User $actor, int $tenantId, int $reportId, ?string $plate): void
    {
        app(TenantAccess::class)->manageTeam($actor, $tenantId);
        self::key($plate);
        DB::transaction(function () use ($actor, $tenantId, $reportId, $plate) {
            Tenant::query()->lockForUpdate()->findOrFail($tenantId);
            app(TenantAccess::class)->manageTeam($actor, $tenantId);
            $report = Report::query()->where('tenant_id', $tenantId)->lockForUpdate()->findOrFail($reportId);
            $report->update(['vehicle_id' => self::resolve($tenantId, $plate)]);
            Audit::record($tenantId, $actor->id, 'report.vehicle_assigned', 'report', $report->id);
        });
    }
}
