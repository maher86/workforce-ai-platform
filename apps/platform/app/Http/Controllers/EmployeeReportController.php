<?php

namespace App\Http\Controllers;

use App\Modules\Identity\EmployeeContext;
use App\Modules\Identity\Membership;
use App\Modules\Media\MediaInput;
use App\Modules\Reporting\ChangeEmployeeReport;
use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportAccess;
use App\Modules\Reporting\ReportActivity;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use App\Modules\Reporting\SubmitReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class EmployeeReportController extends Controller
{
    public function membership(Request $request): Membership
    {
        $member = app(EmployeeContext::class)->resolve($request->user(), (int) $request->session()->get('employee_device_id'));
        // Reject an in-memory upload from a previous device/account, including another tab's login switch.
        if ($request->hasHeader('X-Employee-Upload-Scope')) {
            abort_unless(hash_equals($request->user()->id.':'.$request->session()->get('employee_device_id'), (string) $request->header('X-Employee-Upload-Scope')), 409);
        }

        return $member;
    }

    public function upload(Request $request): RedirectResponse
    {
        $this->membership($request);

        return redirect('/employee');
    }

    public function progress(Request $request): JsonResponse
    {
        $member = $this->membership($request);
        $data = $request->validate(['ids' => 'required|array|min:1|max:20', 'ids.*' => 'required|integer|min:1|distinct']);
        $reports = Report::withTrashed()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id)
            ->whereIn('id', $data['ids'])->select(['id', 'status', 'source_version', 'deleted_at'])
            ->selectSub(ReportMedia::query()->selectRaw('1')->whereColumn('report_id', 'reports.id')->whereColumn('tenant_id', 'reports.tenant_id')->whereNull('retired_at')->where('kind', 'audio')->limit(1), 'has_audio')->get();
        abort_unless($reports->count() === count($data['ids']), 404);
        $stages = ReportOutput::query()->where('tenant_id', $member->tenant_id)->whereIn('report_id', $reports->pluck('id'))
            ->where(fn ($query) => $query->where('stage', 'translation')->orWhere('stage', 'like', 'transcript:%'))
            ->get(['report_id', 'stage'])->groupBy('report_id');

        return response()->json(['reports' => $reports->map(function (Report $report) use ($stages) {
            $status = $report->trashed() ? 'withdrawn' : $report->status;
            $outputs = $stages->get($report->id, collect())->pluck('stage');
            $phase = match ($status) {
                'ready', 'failed', 'withdrawn' => $status,
                'submitted' => 'queued',
                default => $outputs->contains('translation') ? 'finalizing' : (! $report->getAttribute('has_audio') || $outputs->contains(fn ($stage) => str_starts_with($stage, 'transcript:')) ? 'translating' : 'transcribing'),
            };

            return ['id' => $report->id, 'status' => $status, 'source_version' => $report->source_version, 'phase' => $phase];
        })->values()]);
    }

    public function store(Request $request, SubmitReport $submit): JsonResponse
    {
        $member = $this->membership($request);
        $data = $request->validate([
            'submission_key' => ['required', 'uuid'], 'text' => ['nullable', 'string', 'max:10000'],
            'audio' => ['nullable', 'file', 'max:12288'], 'images' => ['nullable', 'array', 'max:3'],
            'images.*' => ['file', 'max:12288'], 'project_id' => ['nullable', 'integer'], 'task_id' => ['nullable', 'integer'],
            'vehicle_plate' => ['nullable', 'string', 'max:80'],
        ]);
        $inputs = [];
        $audio = $request->file('audio');
        if ($audio instanceof UploadedFile) {
            $inputs[] = new MediaInput($audio->getPathname(), 'audio');
        }
        foreach ($request->file('images', []) as $image) {
            $inputs[] = new MediaInput($image->getPathname(), 'image');
        }
        $report = $submit->execute($request->user(), $member->tenant_id, $data['submission_key'], $data['text'] ?? null, $inputs,
            isset($data['project_id']) ? (int) $data['project_id'] : null, isset($data['task_id']) ? (int) $data['task_id'] : null, $data['vehicle_plate'] ?? null);

        // Read database defaults and current processing state after the transaction commits.
        $report = Report::query()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id)->findOrFail($report->id);

        return response()->json(['id' => $report->id, 'status' => $report->status, 'source_version' => $report->source_version], 201);
    }

    public function show(Request $request, int $report, ReportAccess $access): Response
    {
        $member = $this->membership($request);
        $item = $access->view($request->user(), $member->tenant_id, $report);

        return Inertia::render('employee/report', [
            'report' => $item->only(['id', 'status', 'created_at', 'source_version', 'source_text']),
            'textOutputs' => fn () => ReportOutput::query()->where('tenant_id', $member->tenant_id)->where('report_id', $report)->where(fn ($query) => $query->where('stage', 'translation')->orWhere('stage', 'like', 'transcript:%'))->orderBy('id')->get(['stage', 'payload']),
            'media' => fn () => ReportMedia::query()->whereNull('retired_at')->where('tenant_id', $member->tenant_id)->where('report_id', $report)->get(['id', 'kind', 'mime']),
            'editableUntil' => $item->created_at->copy()->addHour()->toIso8601String(),
            'serverNow' => now()->toIso8601String(),
            'aiMode' => config('workforce.ai_provider'),
        ]);
    }

    public function day(Request $request, ReportActivity $activity): JsonResponse
    {
        $member = $this->membership($request);
        $request->validate(['day' => 'required|date_format:Y-m-d']);

        $query = Report::query()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id);
        if ($request->filled('from') || $request->filled('to')) {
            $query = $activity->during($query, $activity->period($request->only(['from', 'to'])));
        }
        $reports = $activity->reports($query, (string) $request->query('day'));
        $attachments = ReportMedia::query()->whereNull('retired_at')->where('tenant_id', $member->tenant_id)->whereIn('report_id', $reports->getCollection()->pluck('id'))
            ->get(['id', 'report_id', 'kind'])->groupBy('report_id');
        foreach ($reports->getCollection() as $report) {
            $report->setAttribute('attachments', $attachments->get($report->id, collect())->map(fn (ReportMedia $media) => $media->only(['id', 'kind']))->values());
        }

        return response()->json($reports);
    }

    public function history(Request $request, ReportActivity $activity): Response
    {
        $member = $this->membership($request);
        $period = $activity->period($request->only(['from', 'to']));
        $query = $activity->during(Report::query()->where('tenant_id', $member->tenant_id)->where('membership_id', $member->id), $period);

        return Inertia::render('employee/history', ['period' => $period, 'days' => $activity->days($query)]);
    }

    public function change(Request $request, int $report, ChangeEmployeeReport $changes): JsonResponse
    {
        $member = $this->membership($request);
        $data = $request->validate([
            'source_version' => 'required|integer|min:1', 'change_key' => 'required|uuid',
            'keep' => 'sometimes|array|max:4', 'keep.*' => 'required|integer|distinct',
            'audio' => 'nullable|file|max:12288', 'images' => 'nullable|array|max:3', 'images.*' => 'file|max:12288',
        ]);
        $inputs = [];
        $audio = $request->file('audio');
        if ($audio instanceof UploadedFile) {
            $inputs[] = new MediaInput($audio->getPathname(), 'audio');
        }
        foreach ($request->file('images', []) as $image) {
            $inputs[] = new MediaInput($image->getPathname(), 'image');
        }
        $item = $changes->execute($request->user(), $member->tenant_id, $report, (int) $data['source_version'], $data['change_key'], array_values(array_map('intval', $data['keep'] ?? [])), $inputs);

        return response()->json(['id' => $item->id, 'source_version' => $item->source_version, 'status' => $item->status]);
    }

    public function destroy(Request $request, int $report, ChangeEmployeeReport $changes): JsonResponse
    {
        $member = $this->membership($request);
        $data = $request->validate(['source_version' => 'required|integer|min:1', 'change_key' => 'required|uuid']);
        $changes->execute($request->user(), $member->tenant_id, $report, (int) $data['source_version'], $data['change_key'], [], [], true);

        return response()->json(['deleted' => true]);
    }

    public function media(Request $request, int $report, int $media, ReportAccess $access): BinaryFileResponse
    {
        $member = $this->membership($request);
        $access->view($request->user(), $member->tenant_id, $report);
        $item = ReportMedia::query()->whereNull('retired_at')->where('tenant_id', $member->tenant_id)->where('report_id', $report)->findOrFail($media);

        return response()->file(Storage::disk('reports')->path($item->path), ['Content-Type' => $item->mime, 'Cache-Control' => 'no-store, private', 'X-Content-Type-Options' => 'nosniff']);
    }
}
