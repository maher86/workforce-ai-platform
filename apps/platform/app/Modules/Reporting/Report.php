<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $membership_id
 * @property string $submission_key
 * @property string $content_hash
 * @property string|null $source_text
 * @property int|null $project_id
 * @property int|null $task_id
 * @property int|null $vehicle_id
 * @property string $status
 * @property string $analysis_mode
 * @property string $review_status
 * @property string|null $failure_code
 * @property int $source_version
 * @property int $version
 * @property Carbon|null $processing_started_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class Report extends Model
{
    use SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['processing_started_at' => 'datetime'];
    }
}
