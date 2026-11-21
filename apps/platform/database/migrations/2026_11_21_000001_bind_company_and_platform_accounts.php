<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->constrained('tenants')->nullOnDelete();
            $table->boolean('platform_admin')->default(false);
        });
        DB::statement("UPDATE users SET company_id = single.tenant_id FROM (SELECT user_id, MIN(tenant_id) AS tenant_id FROM memberships WHERE active = true AND role IN ('owner', 'manager') GROUP BY user_id HAVING COUNT(DISTINCT tenant_id) = 1) AS single WHERE users.id = single.user_id AND users.employee_only = false");
        DB::statement('ALTER TABLE users ADD CONSTRAINT platform_account_has_no_company CHECK (NOT platform_admin OR company_id IS NULL)');
        Schema::create('platform_diagnostic_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->text('reason');
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_diagnostic_access');
        DB::statement('ALTER TABLE users DROP CONSTRAINT platform_account_has_no_company');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('company_id');
            $table->dropColumn('platform_admin');
        });
    }
};
