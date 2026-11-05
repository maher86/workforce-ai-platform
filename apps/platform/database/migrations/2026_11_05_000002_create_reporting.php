<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->unsignedInteger('daily_report_limit')->default(1000);
            $table->unsignedInteger('storage_limit_mb')->default(2048);
            $table->unsignedInteger('retention_days')->default(90);
        });
        Schema::create('work_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('kind');
            $table->string('name', 180);
            $table->unsignedBigInteger('project_id')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['id', 'tenant_id']);
            $table->foreign(['project_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('work_items');
        });
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('membership_id');
            $table->uuid('submission_key');
            $table->string('content_hash', 64);
            $table->text('source_text')->nullable();
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('task_id')->nullable();
            $table->string('status')->default('submitted');
            $table->string('review_status')->default('pending');
            $table->string('failure_code')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('processing_started_at')->nullable();
            $table->timestamps();
            $table->unique(['id', 'tenant_id']);
            $table->unique(['tenant_id', 'membership_id', 'submission_key']);
            $table->index(['tenant_id', 'created_at']);
            $table->foreign(['membership_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('memberships');
            $table->foreign(['project_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('work_items');
            $table->foreign(['task_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('work_items');
        });
        Schema::create('report_media', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('report_id');
            $table->string('kind');
            $table->string('path');
            $table->string('mime');
            $table->unsignedBigInteger('bytes');
            $table->decimal('duration', 8, 3)->nullable();
            $table->string('sha256', 64);
            $table->timestamps();
            $table->foreign(['report_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('reports')->cascadeOnDelete();
        });
        Schema::create('report_outputs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('report_id');
            $table->string('stage');
            $table->string('provider');
            $table->string('model');
            $table->string('prompt_version');
            $table->string('schema_version');
            $table->jsonb('payload');
            $table->jsonb('usage')->nullable();
            $table->timestamps();
            $table->unique(['report_id', 'stage']);
            $table->foreign(['report_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('reports')->cascadeOnDelete();
        });
        Schema::create('report_revisions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('report_id');
            $table->foreignId('actor_id')->constrained('users');
            $table->unsignedInteger('version');
            $table->string('status');
            $table->text('english_report');
            $table->text('reason');
            $table->timestamps();
            $table->unique(['report_id', 'version']);
            $table->foreign(['report_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('reports')->cascadeOnDelete();
        });
        Schema::create('audit_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id');
            $table->timestamps();
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['audit_entries', 'report_revisions', 'report_outputs', 'report_media', 'reports', 'work_items'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('tenants', fn (Blueprint $table) => $table->dropColumn(['daily_report_limit', 'storage_limit_mb', 'retention_days']));
    }
};
