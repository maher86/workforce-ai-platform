<?php

namespace App\Modules\Reporting;

use App\Models\User;
use App\Modules\Identity\Membership;
use App\Modules\Identity\TenantAccess;
use Carbon\CarbonImmutable;

class ReportParticipation
{
    /**
     * @param  array{from: string, to: string}  $period
     * @return array{ranked: list<array{membership_id: int, reports: int, rank: int}>, silent: list<int>, eligible: int, distribution: list<array{membership_id: int, reports: int}>}
     */
    public function summarize(User $actor, int $tenant, array $period): array
    {
        app(TenantAccess::class)->manageTeam($actor, $tenant);
        $members = Membership::query()->where('tenant_id', $tenant)->where('role', 'employee')->orderBy('id')->get();
        $query = Report::query()->where('tenant_id', $tenant)->whereIn('membership_id', $members->modelKeys());
        app(ReportActivity::class)->during($query, $period);
        $counts = $query->selectRaw('membership_id, COUNT(*)::int AS reports')->groupBy('membership_id')->get()
            ->mapWithKeys(fn (Report $row) => [$row->membership_id => (int) $row->getAttribute('reports')]);
        $end = CarbonImmutable::parse($period['to'], ReportActivity::ZONE)->addDay()->startOfDay()->utc();
        $eligible = $members->filter(fn (Membership $member) => $member->active && $member->created_at !== null && $member->created_at->lt($end));
        $ranked = $eligible->map(fn (Membership $member) => ['membership_id' => $member->id, 'reports' => $counts->get($member->id, 0)])
            ->filter(fn (array $row) => $row['reports'] > 0)->sort(fn (array $a, array $b) => ($b['reports'] <=> $a['reports']) ?: ($a['membership_id'] <=> $b['membership_id']))->values();
        $previous = null;
        $rank = 0;
        $rows = [];
        foreach ($ranked as $index => $row) {
            if ($previous !== $row['reports']) {
                $rank = $index + 1;
            }
            $rows[] = [...$row, 'rank' => $rank];
            $previous = $row['reports'];
        }

        $silent = [];
        foreach ($eligible as $member) {
            if ((int) $counts->get($member->id, 0) === 0) {
                $silent[] = $member->id;
            }
        }
        $distribution = [];
        foreach ($members as $member) {
            $count = (int) $counts->get($member->id, 0);
            if ($count > 0) {
                $distribution[] = ['membership_id' => $member->id, 'reports' => $count];
            }
        }

        return [
            'ranked' => $rows,
            'silent' => $silent,
            'eligible' => $eligible->count(),
            // Historical reports remain in chart totals, including employees now inactive.
            'distribution' => $distribution,
        ];
    }
}
