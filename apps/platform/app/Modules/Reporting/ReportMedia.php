<?php

namespace App\Modules\Reporting;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property int $report_id
 * @property string $kind
 * @property string $path
 * @property string $mime
 * @property int $bytes
 * @property string $sha256
 */
class ReportMedia extends Model
{
    protected $table = 'report_media';

    protected $guarded = [];

    protected $hidden = ['path'];
}
