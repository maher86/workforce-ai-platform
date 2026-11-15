<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("SET LOCAL lock_timeout = '5s'");
        Schema::table('reports', function (Blueprint $table): void {
            $table->string('analysis_mode', 16)->default('full');
        });
        DB::statement("ALTER TABLE reports ADD CONSTRAINT report_analysis_mode CHECK (analysis_mode IN ('text', 'full'))");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE reports DROP CONSTRAINT report_analysis_mode');
        Schema::table('reports', function (Blueprint $table): void {
            $table->dropColumn('analysis_mode');
        });
    }
};
