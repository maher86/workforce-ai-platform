<?php

namespace App\Modules\Audit;

use Illuminate\Support\Facades\DB;

class Audit
{
    public static function record(int $tenantId, ?int $actorId, string $action, string $entityType, int $entityId): void
    {
        DB::table('audit_entries')->insert([
            'tenant_id' => $tenantId, 'actor_id' => $actorId, 'action' => $action,
            'entity_type' => $entityType, 'entity_id' => $entityId,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }
}
