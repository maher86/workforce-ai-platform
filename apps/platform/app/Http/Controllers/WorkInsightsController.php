<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportActivity;
use App\Modules\WorkManagement\ReportVehicle;
use App\Modules\WorkManagement\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WorkInsightsController extends Controller
{
    public function __construct(private TenantAccess $access, private ReportActivity $activity) {}

    /** @param list<int> $ids
     * @return array<int, array<string, mixed>>
     */
    private function people(int $tenant, array $ids = []): array
    {
        $members = Membership::query()->where('tenant_id', $tenant)->where('role', 'employee');
        if ($ids !== []) {
            $members->whereIn('id', $ids);
        }

        return $members->select('memberships.*')->selectSub(User::query()->select('name')->whereColumn('id', 'memberships.user_id')->limit(1), 'account_name')
            ->orderBy('id')->get()->mapWithKeys(fn (Membership $member) => [$member->id => [
                'id' => $member->id, 'name' => $member->display_name ?? $member->getAttribute('account_name'), 'active' => $member->active,
                'photo' => $member->profile_photo_path ? '/tenants/'.$tenant.'/employees/'.$member->id.'/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
            ]])->all();
    }

    public function index(Request $request, int $tenant): Response
    {
        $this->access->manageTeam($request->user(), $tenant);
        $data = $request->validate(['from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d', 'employee' => 'nullable|integer']);
        $period = $this->activity->period(array_filter($data, fn ($value) => $value !== null && $value !== ''));
        $employee = ! empty($data['employee']) ? Membership::query()->where('tenant_id', $tenant)->where('role', 'employee')->findOrFail((int) $data['employee'])->id : null;
        $query = $this->activity->during(Report::query()->where('tenant_id', $tenant)->whereIn('membership_id', Membership::query()->where('tenant_id', $tenant)->where('role', 'employee')->select('id')), $period);
        if ($employee !== null) {
            $query->where('membership_id', $employee);
        }
        $counts = (clone $query)->selectRaw('membership_id, COUNT(*)::int as reports, COUNT(DISTINCT '.ReportActivity::DAY.')::int as days')
            ->selectRaw("COUNT(*) FILTER (WHERE review_status = 'approved')::int as approved, COUNT(*) FILTER (WHERE review_status = 'changes_requested')::int as changes")
            ->selectRaw("COUNT(*) FILTER (WHERE status = 'failed')::int as failed, COUNT(*) FILTER (WHERE status IN ('submitted', 'processing'))::int as processing")
            ->groupBy('membership_id')->get()->keyBy('membership_id');
        $people = $this->people($tenant);
        $rows = [];
        foreach ($people as $id => $person) {
            if ($employee !== null && $id !== $employee) {
                continue;
            }
            $count = $counts->get($id);
            $values = [];
            foreach (['reports', 'days', 'approved', 'changes', 'failed', 'processing'] as $field) {
                $values[$field] = (int) ($count?->getAttribute($field) ?? 0);
            }
            $reviewed = $values['approved'] + $values['changes'];
            $rows[] = [...$person, ...$values, 'approvalRate' => $reviewed > 0 ? round(100 * $values['approved'] / $reviewed, 1) : null];
        }
        $daily = (clone $query)->selectRaw(ReportActivity::DAY.' as day, COUNT(*)::int as total')->groupByRaw(ReportActivity::DAY)->get()
            ->mapWithKeys(fn (Report $row) => [(string) $row->getAttribute('day') => (int) $row->getAttribute('total')])->all();
        $series = [];
        for ($day = CarbonImmutable::parse($period['from']); $day->toDateString() <= $period['to']; $day = $day->addDay()) {
            $series[] = ['day' => $day->toDateString(), 'total' => $daily[$day->toDateString()] ?? 0];
        }

        return Inertia::render('insights/index', [
            'tenant' => Tenant::query()->findOrFail($tenant), 'period' => $period, 'selectedEmployee' => $employee,
            'people' => array_values($people), 'metrics' => $rows, 'series' => $series,
            'days' => $employee !== null ? $this->activity->days($query) : null,
            'timezone' => ReportActivity::ZONE,
        ]);
    }

    public function vehicles(Request $request, int $tenant): Response
    {
        $this->access->manageTeam($request->user(), $tenant);
        $request->validate(['search' => 'nullable|string|max:80']);
        $search = trim((string) $request->query('search', ''));
        $query = Vehicle::query()->where('tenant_id', $tenant);
        if ($search !== '') {
            $query->where('plate_key', 'like', '%'.ReportVehicle::key($search).'%');
        }
        $query->select('vehicles.id', 'vehicles.plate')->selectSub(Report::query()->selectRaw('COUNT(*)')->whereColumn('vehicle_id', 'vehicles.id')->whereColumn('tenant_id', 'vehicles.tenant_id'), 'report_count')
            ->selectSub(Report::query()->selectRaw('COUNT(DISTINCT membership_id)')->whereColumn('vehicle_id', 'vehicles.id')->whereColumn('tenant_id', 'vehicles.tenant_id'), 'employee_count');

        return Inertia::render('vehicles/index', ['tenant' => Tenant::query()->findOrFail($tenant), 'vehicles' => $query->orderByDesc('id')->paginate(24)->withQueryString(), 'search' => $search]);
    }

    public function vehicle(Request $request, int $tenant, int $vehicle): Response
    {
        $this->access->manageTeam($request->user(), $tenant);
        $car = Vehicle::query()->where('tenant_id', $tenant)->findOrFail($vehicle);
        $query = Report::query()->where('tenant_id', $tenant)->where('vehicle_id', $vehicle);
        $counts = (clone $query)->selectRaw('membership_id, COUNT(*)::int as reports')->groupBy('membership_id')->get()->mapWithKeys(fn (Report $report) => [$report->membership_id => (int) $report->getAttribute('reports')])->all();
        $contributors = $counts === [] ? [] : array_values($this->people($tenant, array_keys($counts)));

        return Inertia::render('vehicles/show', ['tenant' => Tenant::query()->findOrFail($tenant), 'vehicle' => $car, 'contributors' => $contributors,
            'counts' => $counts, 'total' => array_sum($counts), 'days' => $this->activity->days($query)]);
    }

    public function assign(Request $request, int $tenant, int $report, ReportVehicle $vehicles): RedirectResponse
    {
        $data = $request->validate(['vehicle_plate' => 'nullable|string|max:80']);
        $vehicles->assign($request->user(), $tenant, $report, $data['vehicle_plate'] ?? null);

        return back();
    }
}
