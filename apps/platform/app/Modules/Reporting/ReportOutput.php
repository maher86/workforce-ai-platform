<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $report_id
 * @property string $stage
 * @property string $provider
 * @property string $model
 * @property array<string, mixed> $payload
 */
class ReportOutput extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['payload' => 'array', 'usage' => 'array'];
    }
}
