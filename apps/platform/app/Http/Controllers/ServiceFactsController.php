<?php

namespace App\Http\Controllers;

use App\Modules\Reporting\ConfirmServiceFacts;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ServiceFactsController extends Controller
{
    public function store(Request $request, int $tenant, int $report, ConfirmServiceFacts $facts): RedirectResponse
    {
        $facts->execute($request->user(), $tenant, $report, $request->only(['version', 'source_version', 'service_type', 'started_at', 'ended_at', 'rework', 'rework_reason', 'confirmation_note']));

        return back();
    }
}
