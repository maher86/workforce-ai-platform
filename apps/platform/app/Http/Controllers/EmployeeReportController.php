<?php

namespace App\Http\Controllers;

use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\Membership;
use App\Modules\Media\MediaInput;
use App\Modules\Reporting\ReportAccess;
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
        abort_unless($request->user()?->employee_only, 403);
        $device = EmployeeDevice::query()->whereNull('revoked_at')->where('expires_at', '>', now())
            ->findOrFail((int) $request->session()->get('employee_device_id'));

        return Membership::query()->where('tenant_id', $device->tenant_id)->where('user_id', $request->user()->id)
            ->where('active', true)->findOrFail($device->membership_id);
    }

    public function store(Request $request, SubmitReport $submit): JsonResponse
    {
        $member = $this->membership($request);
        $data = $request->validate([
            'submission_key' => ['required', 'uuid'], 'text' => ['nullable', 'string', 'max:10000'],
            'audio' => ['nullable', 'file', 'max:12288'], 'images' => ['nullable', 'array', 'max:3'],
            'images.*' => ['file', 'max:12288'], 'project_id' => ['nullable', 'integer'], 'task_id' => ['nullable', 'integer'],
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
            isset($data['project_id']) ? (int) $data['project_id'] : null, isset($data['task_id']) ? (int) $data['task_id'] : null);

        return response()->json(['id' => $report->id, 'status' => $report->status], 201);
    }

    public function show(Request $request, int $report, ReportAccess $access): Response
    {
        $member = $this->membership($request);
        $item = $access->view($request->user(), $member->tenant_id, $report);

        return Inertia::render('employee/report', [
            'report' => $item->only(['id', 'source_text', 'status', 'created_at']),
            'media' => ReportMedia::query()->where('tenant_id', $member->tenant_id)->where('report_id', $report)->get(['id', 'kind', 'mime']),
        ]);
    }

    public function media(Request $request, int $report, int $media, ReportAccess $access): BinaryFileResponse
    {
        $member = $this->membership($request);
        $access->view($request->user(), $member->tenant_id, $report);
        $item = ReportMedia::query()->where('tenant_id', $member->tenant_id)->where('report_id', $report)->findOrFail($media);

        return response()->file(Storage::disk('reports')->path($item->path), ['Content-Type' => $item->mime, 'Cache-Control' => 'no-store, private', 'X-Content-Type-Options' => 'nosniff']);
    }
}
