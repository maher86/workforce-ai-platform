<?php

namespace App\Modules\Identity;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Media\MediaInput;
use App\Modules\Media\PrepareMedia;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Throwable;

class UpdateEmployeeProfile
{
    public function __construct(private TenantAccess $access, private PrepareMedia $media) {}

    /** @param array{name?: string, phone?: string|null} $details */
    public function execute(User $actor, int $tenantId, int $membershipId, array $details = [], ?MediaInput $photo = null): void
    {
        $actorMember = $this->access->member($actor, $tenantId);
        $self = $actor->employee_only && $actorMember->role === 'employee' && $actorMember->id === $membershipId;
        if ($self) {
            abort_unless($details === [], 403);
        } else {
            $this->access->manageTeam($actor, $tenantId);
        }
        $target = Membership::query()->where('tenant_id', $tenantId)->where('role', 'employee')->findOrFail($membershipId);
        Validator::make($details, ['name' => 'sometimes|required|string|max:120', 'phone' => ['sometimes', 'nullable', 'regex:/^\+[1-9][0-9]{6,14}$/']])->validate();
        $prepared = null;
        if ($photo !== null) {
            Validator::make(['kind' => $photo->kind, 'bytes' => filesize($photo->sourcePath)], ['kind' => 'in:image', 'bytes' => 'required|integer|min:1|max:4194304'])->validate();
            $prepared = $this->media->prepare($photo, 512);
        }
        $newPath = null;
        $oldPath = null;
        try {
            DB::transaction(function () use ($actor, $tenantId, $target, $details, $prepared, &$newPath, &$oldPath, $self) {
                // Serialize replacements; revalidate actor membership before writing.
                $member = Membership::query()->where('tenant_id', $tenantId)->lockForUpdate()->findOrFail($target->id);
                $this->access->member($actor, $tenantId);
                if (! $self) {
                    $this->access->manageTeam($actor, $tenantId);
                }
                if (array_key_exists('name', $details)) {
                    $member->display_name = $details['name'];
                }
                if (array_key_exists('phone', $details)) {
                    $member->phone = $details['phone'];
                }
                if ($prepared !== null) {
                    $newPath = 'profiles/'.$tenantId.'/'.$member->id.'/'.basename($prepared->path);
                    Storage::disk('reports')->move($prepared->path, $newPath);
                    $oldPath = $member->profile_photo_path;
                    $member->profile_photo_path = $newPath;
                }
                $member->save();
                Audit::record($tenantId, $actor->id, 'employee.profile_updated', 'membership', $member->id);
            });
        } catch (Throwable $exception) {
            if ($prepared) {
                Storage::disk('reports')->delete(array_filter([$prepared->path, $newPath]));
            }
            throw $exception;
        }
        if ($oldPath !== null) {
            // A failure here leaves an unreferenced file for scheduled cleanup.
            try {
                Storage::disk('reports')->delete($oldPath);
            } catch (Throwable) {
                Log::warning('profile_photo_cleanup_pending', ['tenant_id' => $tenantId, 'membership_id' => $membershipId]);
            }
        }
    }
}
