<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ServiceInsights
{
    /** @param Builder<Report> $reports
     * @return array<string, mixed>
     */
    public function summarize(Builder $reports, int $tenant): array
    {
        $latest = DB::table('report_service_facts')->where('tenant_id', $tenant)->selectRaw('report_id, MAX(version) as version')->groupBy('report_id');
        $facts = DB::table('report_service_facts as facts')->joinSub($latest, 'latest', fn ($join) => $join->on('facts.report_id', '=', 'latest.report_id')->on('facts.version', '=', 'latest.version'))
            ->join('reports as current_report', function ($join) {
                $join->on('facts.report_id', '=', 'current_report.id')->on('facts.tenant_id', '=', 'current_report.tenant_id')->on('facts.source_version', '=', 'current_report.source_version');
            })->where('facts.tenant_id', $tenant)->whereIn('facts.report_id', (clone $reports)->select('reports.id'));
        $counts = (clone $facts)->selectRaw('COUNT(*)::int as confirmed, COUNT(service_type)::int as classified, COUNT(rework)::int as assessed, COUNT(started_at)::int as timed')
            ->selectRaw('COUNT(*) FILTER (WHERE rework IS TRUE)::int as reworks, AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as average_minutes')->first();
        $assessed = (int) ($counts->assessed ?? 0);

        return [
            'confirmed' => (int) ($counts->confirmed ?? 0), 'classified' => (int) ($counts->classified ?? 0),
            'assessed' => $assessed, 'timed' => (int) ($counts->timed ?? 0), 'reworks' => (int) ($counts->reworks ?? 0),
            'reworkRate' => $assessed > 0 ? round(100 * $counts->reworks / $assessed, 1) : null,
            'averageMinutes' => $counts->average_minutes !== null ? round((float) $counts->average_minutes, 1) : null,
            'services' => (clone $facts)->whereNotNull('service_type')->selectRaw('service_type as label, COUNT(*)::int as total')->groupBy('service_type')->orderByDesc('total')->orderBy('service_type')->get()->all(),
        ];
    }
}
