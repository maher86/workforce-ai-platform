<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_media', fn (Blueprint $table) => $table->index(['tenant_id', 'report_id', 'retired_at'], 'report_media_active_report'));
    }

    public function down(): void
    {
        Schema::table('report_media', fn (Blueprint $table) => $table->dropIndex('report_media_active_report'));
    }
};
