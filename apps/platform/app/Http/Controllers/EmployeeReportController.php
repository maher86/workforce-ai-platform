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
use App\Modules\Reporting\SubmitReport;
use Illuminate\Http\JsonResponse;
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
        return app(EmployeeContext::class)->resolve($request->user(), (int) $request->session()->get('employee_device_id'));
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

        return response()->json(['id' => $report->id, 'status' => $report->status], 201);
    }

    public function show(Request $request, int $report, ReportAccess $access): Response
    {
        $member = $this->membership($request);
        $item = $access->view($request->user(), $member->tenant_id, $report);

        return Inertia::render('employee/report', [
            'report' => $item->only(['id', 'status', 'created_at', 'source_version']),
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

        return response()->json(['id' => $item->id, 'source_version' => $item->source_version]);
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
