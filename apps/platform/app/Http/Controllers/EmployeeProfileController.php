<?php

namespace App\Http\Controllers;

use App\Modules\Identity\EmployeeContext;
use App\Modules\Identity\TenantAccess;
use App\Modules\Identity\UpdateEmployeeProfile;
use App\Modules\Media\MediaInput;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class EmployeeProfileController extends Controller
{
    public function update(Request $request, EmployeeContext $context, UpdateEmployeeProfile $profile): RedirectResponse
    {
        $member = $context->resolve($request->user(), (int) $request->session()->get('employee_device_id'));
        $request->validate(['photo' => 'required|file|max:4096']);
        $photo = $request->file('photo');
        abort_unless($photo instanceof UploadedFile, 422);
        $profile->execute($request->user(), $member->tenant_id, $member->id, [], new MediaInput($photo->getPathname(), 'image'));

        return back()->with('profile_saved', true);
    }

    public function managerUpdate(Request $request, int $tenant, int $membership, UpdateEmployeeProfile $profile): RedirectResponse
    {
        $data = $request->validate(['name' => 'required|string|max:120', 'phone' => ['nullable', 'regex:/^\+[1-9][0-9]{6,14}$/'], 'photo' => 'nullable|file|max:4096']);
        $photo = $request->file('photo');
        $profile->execute($request->user(), $tenant, $membership, ['name' => $data['name'], 'phone' => $data['phone'] ?? null], $photo instanceof UploadedFile ? new MediaInput($photo->getPathname(), 'image') : null);

        return back();
    }

    public function photo(Request $request, EmployeeContext $context): BinaryFileResponse
    {
        $member = $context->resolve($request->user(), (int) $request->session()->get('employee_device_id'));

        return $this->file($member->profile_photo_path);
    }

    public function managerPhoto(Request $request, int $tenant, int $membership, TenantAccess $access): BinaryFileResponse
    {
        $member = $access->employee($request->user(), $tenant, $membership);

        return $this->file($member->profile_photo_path);
    }

    private function file(?string $path): BinaryFileResponse
    {
        abort_if($path === null, 404);

        return response()->file(Storage::disk('reports')->path($path), ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'no-store, private', 'X-Content-Type-Options' => 'nosniff']);
    }
}
