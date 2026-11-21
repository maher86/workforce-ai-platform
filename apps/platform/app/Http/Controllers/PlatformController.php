<?php

namespace App\Http\Controllers;

use App\Modules\Audit\Audit;
use App\Modules\Identity\Membership;
use App\Modules\Identity\Tenant;
use App\Modules\Reporting\Report;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PlatformController extends Controller
{
    public function index(Request $request): Response
    {
        $request->validate(['search' => 'nullable|string|max:120']);
        $search = trim((string) $request->query('search', ''));
        $companies = Tenant::query()->select(['id', 'name', 'created_at']);
        if ($search !== '') {
            $companies->where('name', 'ilike', '%'.$search.'%');
        }

        return Inertia::render('platform/index', ['companies' => $companies->orderByDesc('id')->paginate(25)->withQueryString(), 'search' => $search]);
    }

    public function start(Request $request, int $tenant): RedirectResponse
    {
        Tenant::query()->findOrFail($tenant);
        $data = $request->validate(['reason' => 'required|string|min:10|max:500']);
        $id = DB::transaction(function () use ($request, $tenant, $data) {
            $id = DB::table('platform_diagnostic_access')->insertGetId([
                'user_id' => $request->user()->id, 'tenant_id' => $tenant,
                'reason' => Crypt::encryptString($data['reason']), 'expires_at' => now()->addMinutes(15), 'created_at' => now(), 'updated_at' => now(),
            ]);
            Audit::record($tenant, $request->user()->id, 'platform.diagnostics_started', 'platform_diagnostic_access', $id);

            return $id;
        });

        return redirect('/platform/diagnostics/'.$id);
    }

    public function show(Request $request, int $access): Response
    {
        /** @var object{tenant_id: int, reason: string, expires_at: string}|null $grant */
        $grant = DB::table('platform_diagnostic_access')->where('id', $access)->where('user_id', $request->user()->id)->where('expires_at', '>', now())->first();
        abort_unless($grant !== null, 404);
        $tenant = (int) $grant->tenant_id;
        Audit::record($tenant, $request->user()->id, 'platform.diagnostics_viewed', 'platform_diagnostic_access', $access);

        return Inertia::render('platform/diagnostics', [
            'company' => Tenant::query()->findOrFail($tenant)->only(['id', 'name']),
            'reason' => Crypt::decryptString($grant->reason), 'expiresAt' => CarbonImmutable::parse($grant->expires_at, 'UTC')->toIso8601String(),
            'summary' => [
                'employees' => Membership::query()->where('tenant_id', $tenant)->where('role', 'employee')->where('active', true)->count(),
                'reports' => Report::query()->where('tenant_id', $tenant)->count(),
                'processing' => Report::query()->where('tenant_id', $tenant)->whereIn('status', ['submitted', 'processing'])->count(),
                'failed' => Report::query()->where('tenant_id', $tenant)->where('status', 'failed')->count(),
            ],
            // Deliberately omit source text, translations, names, phones and media.
            'failures' => Report::query()->where('tenant_id', $tenant)->where('status', 'failed')->latest('id')->limit(25)->get(['id', 'status', 'failure_code', 'created_at']),
        ]);
    }
}
