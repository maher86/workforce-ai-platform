<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportActivity;
use App\Modules\Reporting\ReportOutput;
use App\Modules\WorkManagement\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ManagerOverviewController extends Controller
{
    public function index(Request $request, int $tenant, ?int $membership = null): Response
    {
        app(TenantAccess::class)->manageTeam($request->user(), $tenant);
        $data = $request->validate([
            'range' => 'nullable|in:today,yesterday,7,30,month,custom,all',
            'from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d',
            'employee' => 'nullable|integer',
            'vehicle' => 'nullable|integer',
        ]);
        $members = Membership::query()->where('tenant_id', $tenant)->where('role', 'employee')
            ->select('memberships.*')->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')->orderBy('id')->get();
        $employee = $membership ?? (! empty($data['employee']) ? (int) $data['employee'] : null);
        if ($employee !== null) {
            abort_unless($members->contains('id', $employee), 404);
        }
        $people = $members->map(fn (Membership $member) => [
            'id' => $member->id, 'name' => $member->display_name ?? $member->getAttribute('account_name'),
            'phone' => $member->phone, 'active' => $member->active,
            'photo' => $member->profile_photo_path ? '/tenants/'.$tenant.'/employees/'.$member->id.'/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
        ])->all();
        $query = Report::query()->where('tenant_id', $tenant)->whereIn('membership_id', $members->pluck('id'));
        $vehicle = ! empty($data['vehicle']) ? Vehicle::query()->where('tenant_id', $tenant)->findOrFail((int) $data['vehicle']) : null;
        if ($vehicle !== null) {
            $query->where('vehicle_id', $vehicle->id);
        }
        if ($employee !== null) {
            $query->where('membership_id', $employee);
        }
        $today = CarbonImmutable::now(ReportActivity::ZONE)->startOfDay();
        $range = $data['range'] ?? ((! empty($data['from']) || ! empty($data['to'])) ? 'custom' : ($membership !== null ? 'all' : 'today'));
        $from = match ($range) {
            'yesterday' => $today->subDay()->toDateString(),
            '7' => $today->subDays(6)->toDateString(),
            '30' => $today->subDays(29)->toDateString(),
            'month' => $today->startOfMonth()->toDateString(),
            'all' => ($first = (clone $query)->min('created_at')) ? CarbonImmutable::parse($first, 'UTC')->setTimezone(ReportActivity::ZONE)->toDateString() : $today->toDateString(),
            'custom' => $data['from'] ?? $today->toDateString(),
            default => $today->toDateString(),
        };
        $to = $range === 'yesterday' ? $from : ($range === 'custom' ? ($data['to'] ?? $today->toDateString()) : $today->toDateString());
        $period = $range === 'all' ? ['from' => $from, 'to' => $to] : app(ReportActivity::class)->period(['from' => $from, 'to' => $to]);
        app(ReportActivity::class)->during($query, $period);
        $summary = (clone $query)->selectRaw("COUNT(*)::int as reports, COUNT(DISTINCT membership_id)::int as contributors, COUNT(*) FILTER (WHERE status IN ('submitted', 'processing'))::int as processing, COUNT(*) FILTER (WHERE status = 'failed')::int as failed")->firstOrFail();
        $monthly = CarbonImmutable::parse($from)->diffInDays(CarbonImmutable::parse($to)) > 365;
        $bucket = $monthly ? 'to_char('.ReportActivity::DAY.", 'YYYY-MM')" : ReportActivity::DAY;
        $counts = (clone $query)->selectRaw($bucket.' as bucket, COUNT(*)::int as total')->groupByRaw($bucket)->get()->mapWithKeys(fn (Report $row) => [(string) $row->getAttribute('bucket') => (int) $row->getAttribute('total')]);
        $series = [];
        $day = CarbonImmutable::parse($from);
        if ($monthly) {
            $day = $day->startOfMonth();
        }
        for (; $day->toDateString() <= $to; $day = $monthly ? $day->addMonth() : $day->addDay()) {
            $key = $monthly ? $day->format('Y-m') : $day->toDateString();
            $series[] = ['day' => $key, 'total' => $counts->get($key, 0)];
        }
        $reports = (clone $query)->select(['reports.id', 'reports.membership_id', 'reports.status', 'reports.created_at'])->selectRaw('LEFT(reports.source_text, 240) as source_text')
            ->selectSub(ReportOutput::query()->selectRaw("LEFT(payload->>'summary', 320)")->whereColumn('tenant_id', 'reports.tenant_id')->whereColumn('report_id', 'reports.id')->where('stage', 'structured')->limit(1), 'summary')
            ->orderByDesc('created_at')->orderByDesc('id')->paginate(25)->withQueryString();

        return Inertia::render('reports/index', [
            'tenant' => Tenant::query()->findOrFail($tenant)->only(['id', 'name']),
            'workspaces' => Tenant::query()->whereIn('id', Membership::query()->where('user_id', $request->user()->id)->where('active', true)->whereIn('role', ['owner', 'manager'])->select('tenant_id'))->get(['id', 'name']),
            'people' => $people, 'selectedEmployee' => $employee, 'profile' => $membership !== null,
            'period' => $period, 'range' => $range, 'summary' => $summary->only(['reports', 'contributors', 'processing', 'failed']),
            'reports' => $reports, 'series' => $series, 'monthly' => $monthly, 'aiMode' => config('workforce.ai_provider'),
            'vehicle' => $vehicle?->only(['id', 'plate']),
        ]);
    }
}
