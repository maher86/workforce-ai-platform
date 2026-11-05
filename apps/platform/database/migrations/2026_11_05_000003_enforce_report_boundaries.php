<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE report_media ADD CONSTRAINT report_media_path_owner CHECK (path LIKE tenant_id::text || '/' || report_id::text || '/%')");
        DB::statement("ALTER TABLE reports ADD CONSTRAINT reports_state CHECK (status IN ('submitted','processing','ready','failed') AND review_status IN ('pending','approved','changes_requested'))");
        DB::statement("ALTER TABLE work_items ADD CONSTRAINT work_items_kind CHECK (kind IN ('project','task') AND (kind <> 'project' OR project_id IS NULL) AND (project_id IS NULL OR project_id <> id))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE report_media DROP CONSTRAINT report_media_path_owner');
        DB::statement('ALTER TABLE reports DROP CONSTRAINT reports_state');
        DB::statement('ALTER TABLE work_items DROP CONSTRAINT work_items_kind');
    }
};
