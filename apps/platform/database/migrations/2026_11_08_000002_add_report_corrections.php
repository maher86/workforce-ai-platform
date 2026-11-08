<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->unsignedInteger('source_version')->default(1);
            $table->softDeletes();
            $table->index(['tenant_id', 'membership_id', 'deleted_at', 'created_at'], 'reports_employee_history');
        });
        Schema::table('report_media', fn (Blueprint $table) => $table->timestamp('retired_at')->nullable());
        Schema::table('report_revisions', fn (Blueprint $table) => $table->unsignedInteger('source_version')->default(1));
        Schema::table('report_service_facts', fn (Blueprint $table) => $table->unsignedInteger('source_version')->default(1));
        Schema::create('report_source_changes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('report_id');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('source_version');
            $table->uuid('change_key');
            $table->string('request_hash', 64);
            $table->string('kind');
            $table->text('source_text')->nullable();
            $table->string('review_status');
            $table->jsonb('media_ids');
            $table->jsonb('outputs');
            $table->timestamps();
            $table->unique(['report_id', 'source_version']);
            $table->unique(['report_id', 'change_key']);
            $table->foreign(['report_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('reports')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('report_source_changes');
        Schema::table('report_service_facts', fn (Blueprint $table) => $table->dropColumn('source_version'));
        Schema::table('report_revisions', fn (Blueprint $table) => $table->dropColumn('source_version'));
        Schema::table('report_media', fn (Blueprint $table) => $table->dropColumn('retired_at'));
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex('reports_employee_history');
            $table->dropSoftDeletes();
            $table->dropColumn('source_version');
        });
    }
};
