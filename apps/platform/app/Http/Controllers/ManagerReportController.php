<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Identity\TenantAccess;
use App\Modules\Reporting\PurgeReport;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\ReportRevision;
use App\Modules\Reporting\ReportSubmitted;
use App\Modules\Reporting\ReviewReport;
use App\Modules\WorkManagement\WorkItem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ManagerReportController extends Controller
{
    public function __construct(private TenantAccess $access) {}

    /** @return Builder<Report> */
    private function query(Request $request, int $tenant): Builder
    {
        $this->access->manageTeam($request->user(), $tenant);
        $data = $request->validate([
            'status' => 'nullable|in:submitted,processing,ready,failed', 'review_status' => 'nullable|in:pending,approved,changes_requested',
            'employee' => 'nullable|integer', 'from' => 'nullable|date_format:Y-m-d', 'to' => 'nullable|date_format:Y-m-d',
        ]);
        if (! empty($data['from']) && ! empty($data['to']) && $data['to'] < $data['from']) {
            throw ValidationException::withMessages(['to' => 'نهاية الفترة يجب أن تكون بعد بدايتها.']);
        }
        $query = Report::query()->where('tenant_id', $tenant);
        foreach (['status', 'review_status'] as $field) {
            if (! empty($data[$field])) {
                $query->where($field, $data[$field]);
            }
        }
        if (! empty($data['employee'])) {
            $query->where('membership_id', (int) $data['employee']);
        }
        if (! empty($data['from'])) {
            $query->where('created_at', '>=', $data['from'].' 00:00:00');
        }
        if (! empty($data['to'])) {
            $query->where('created_at', '<', CarbonImmutable::parse($data['to'])->addDay());
        }

        return $query;
    }

    public function index(Request $request, int $tenant): Response
    {
        $query = $this->query($request, $tenant);
        $reports = $query->latest('id')->paginate(25)->withQueryString();
        $members = Membership::query()->where('tenant_id', $tenant)->get();
        $names = User::query()->whereIn('id', $members->pluck('user_id'))->pluck('name', 'id');
        $employeeNames = $members->mapWithKeys(fn (Membership $member) => [$member->id => $member->display_name ?? $names[$member->user_id] ?? 'Employee'])->all();

        return Inertia::render('reports/index', [
            'tenant' => Tenant::query()->findOrFail($tenant), 'reports' => $reports,
            'employeeNames' => $employeeNames, 'filters' => $request->only(['status', 'review_status', 'employee', 'from', 'to']),
            'workItems' => WorkItem::query()->where('tenant_id', $tenant)->latest('id')->get(),
            'aiMode' => config('workforce.ai_provider'),
        ]);
    }

    public function show(Request $request, int $tenant, int $report): Response
    {
        $actor = $this->access->manageTeam($request->user(), $tenant);
        $item = Report::query()->where('tenant_id', $tenant)->findOrFail($report);
        $member = Membership::query()->where('tenant_id', $tenant)->findOrFail($item->membership_id);

        return Inertia::render('reports/show', [
            'report' => $item, 'employeeName' => $member->display_name ?? User::query()->findOrFail($member->user_id)->name,
            'employeePhone' => $member->phone,
            'employeePhotoUrl' => $member->profile_photo_path ? '/tenants/'.$tenant.'/employees/'.$member->id.'/photo?v='.substr(hash('sha256', $member->profile_photo_path), 0, 16) : null,
            'media' => ReportMedia::query()->where('tenant_id', $tenant)->where('report_id', $report)->get(['id', 'kind', 'mime', 'bytes', 'duration']),
            'outputs' => ReportOutput::query()->where('tenant_id', $tenant)->where('report_id', $report)->orderBy('id')->get(),
            'revisions' => ReportRevision::query()->where('tenant_id', $tenant)->where('report_id', $report)->latest('version')->get(),
            'aiMode' => config('workforce.ai_provider'),
            'canDelete' => $actor->role === 'owner',
        ]);
    }

    public function destroy(Request $request, int $tenant, int $report, PurgeReport $purge): RedirectResponse
    {
        $actor = $this->access->manageTeam($request->user(), $tenant);
        abort_unless($actor->role === 'owner', 403);
        $purge->execute($tenant, $report, $request->user()->id);

        return redirect('/tenants/'.$tenant.'/reports');
    }

    public function media(Request $request, int $tenant, int $report, int $media): BinaryFileResponse
    {
        $this->access->manageTeam($request->user(), $tenant);
        Report::query()->where('tenant_id', $tenant)->findOrFail($report);
        $item = ReportMedia::query()->where('tenant_id', $tenant)->where('report_id', $report)->findOrFail($media);

        return response()->file(Storage::disk('reports')->path($item->path), ['Content-Type' => $item->mime, 'Cache-Control' => 'no-store, private', 'X-Content-Type-Options' => 'nosniff']);
    }

    public function review(Request $request, int $tenant, int $report, ReviewReport $review): RedirectResponse
    {
        $data = $request->validate(['version' => 'required|integer|min:1', 'english_report' => 'required|string|max:30000', 'reason' => 'required|string|max:2000', 'status' => 'required|in:approved,changes_requested']);
        $review->execute($request->user(), $tenant, $report, (int) $data['version'], $data['english_report'], $data['reason'], $data['status']);

        return back();
    }

    public function retry(Request $request, int $tenant, int $report): RedirectResponse
    {
        $this->access->manageTeam($request->user(), $tenant);
        DB::transaction(function () use ($request, $tenant, $report) {
            $item = Report::query()->where('tenant_id', $tenant)->lockForUpdate()->findOrFail($report);
            abort_unless($item->status === 'failed', 409);
            $item->update(['status' => 'submitted', 'review_status' => 'pending', 'failure_code' => null, 'processing_started_at' => null]);
            Audit::record($tenant, $request->user()->id, 'report.retry', 'report', $report);
            event(new ReportSubmitted($tenant, $report));
        });

        return back();
    }

    public function work(Request $request, int $tenant): RedirectResponse
    {
        $this->access->manageTeam($request->user(), $tenant);
        $data = $request->validate(['name' => 'required|string|max:180', 'kind' => 'required|in:project,task', 'project_id' => 'nullable|integer']);
        if (isset($data['project_id'])) {
            WorkItem::query()->where('tenant_id', $tenant)->where('kind', 'project')->where('active', true)->findOrFail((int) $data['project_id']);
        }
        abort_if($data['kind'] === 'project' && isset($data['project_id']), 422);
        $item = WorkItem::query()->create(['tenant_id' => $tenant, ...$data]);
        Audit::record($tenant, $request->user()->id, 'work.created', 'work_item', $item->id);

        return back();
    }

    public function closeWork(Request $request, int $tenant, int $work): RedirectResponse
    {
        $this->access->manageTeam($request->user(), $tenant);
        $item = WorkItem::query()->where('tenant_id', $tenant)->findOrFail($work);
        DB::transaction(function () use ($item, $tenant, $request, $work) {
            $item->update(['active' => false]);
            if ($item->kind === 'project') {
                WorkItem::query()->where('tenant_id', $tenant)->where('project_id', $item->id)->update(['active' => false]);
            }
            Audit::record($tenant, $request->user()->id, 'work.closed', 'work_item', $work);
        });

        return back();
    }

    public function export(Request $request, int $tenant): StreamedResponse
    {
        $query = $this->query($request, $tenant);
        $query->select('reports.*')
            ->selectSub(DB::table('memberships')->join('users', 'users.id', '=', 'memberships.user_id')->selectRaw('COALESCE(memberships.display_name, users.name)')->whereColumn('memberships.id', 'reports.membership_id')->whereColumn('memberships.tenant_id', 'reports.tenant_id')->limit(1), 'export_employee')
            ->selectSub(ReportRevision::query()->select('english_report')->whereColumn('report_id', 'reports.id')->whereColumn('tenant_id', 'reports.tenant_id')->latest('version')->limit(1), 'export_review')
            ->selectSub(ReportOutput::query()->selectRaw("payload->>'summary'")->whereColumn('report_id', 'reports.id')->whereColumn('tenant_id', 'reports.tenant_id')->where('stage', 'structured')->limit(1), 'export_summary')
            ->selectSub(ReportOutput::query()->select('provider')->whereColumn('report_id', 'reports.id')->whereColumn('tenant_id', 'reports.tenant_id')->where('stage', 'structured')->limit(1), 'export_provider');
        Audit::record($tenant, $request->user()->id, 'report.export', 'tenant', $tenant);

        return response()->streamDownload(function () use ($query) {
            $stream = fopen('php://output', 'wb');
            if ($stream === false) {
                return;
            }
            fwrite($stream, "\xEF\xBB\xBF");
            fputcsv($stream, ['ID', 'Employee', 'Submitted UTC', 'Processing', 'Review', 'AI provider', 'Original text', 'English report'], escape: '');
            foreach ($query->orderBy('id')->cursor() as $report) {
                $english = (string) ($report->getAttribute('export_review') ?? $report->getAttribute('export_summary') ?? '');
                $values = [(string) $report->id, (string) $report->getAttribute('export_employee'), $report->created_at->toIso8601String(), $report->status, $report->review_status, (string) ($report->getAttribute('export_provider') ?? 'pending'), $report->source_text ?? '', $english];
                $safe = array_map(fn (string $value) => preg_match('/^[\s\x00-\x1F]*[=+@-]/u', $value) ? "'".$value : $value, $values);
                fputcsv($stream, $safe, escape: '');
            }
            fclose($stream);
        }, 'reports.csv', ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store, private']);
    }
}
