<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_service_facts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('report_id');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('version');
            $table->string('service_type', 100)->nullable();
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('ended_at')->nullable();
            $table->boolean('rework')->nullable();
            $table->text('rework_reason')->nullable();
            $table->text('confirmation_note');
            $table->timestamps();
            $table->unique(['report_id', 'version']);
            $table->index(['tenant_id', 'report_id', 'version']);
            $table->foreign(['report_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('reports')->cascadeOnDelete();
        });
        DB::statement('ALTER TABLE report_service_facts ADD CONSTRAINT service_fact_times CHECK ((started_at IS NULL AND ended_at IS NULL) OR (started_at IS NOT NULL AND ended_at IS NOT NULL AND ended_at > started_at))');
        DB::statement('ALTER TABLE report_service_facts ADD CONSTRAINT service_fact_rework CHECK ((rework IS TRUE AND rework_reason IS NOT NULL AND length(trim(rework_reason)) > 0) OR (rework IS NOT TRUE AND rework_reason IS NULL))');
    }

    public function down(): void
    {
        Schema::dropIfExists('report_service_facts');
    }
};
