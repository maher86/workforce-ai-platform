<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Existing reports keep their original general contract; no evidence is regenerated.
        foreach (['tenants', 'reports'] as $name) {
            Schema::table($name, fn (Blueprint $table) => $table->string('reporting_domain', 24)->default('general'));
            DB::statement("ALTER TABLE {$name} ADD CONSTRAINT {$name}_reporting_domain_valid CHECK (reporting_domain IN ('general', 'automotive'))");
        }
    }

    public function down(): void
    {
        foreach (['reports', 'tenants'] as $name) {
            DB::statement("ALTER TABLE {$name} DROP CONSTRAINT {$name}_reporting_domain_valid");
            Schema::table($name, fn (Blueprint $table) => $table->dropColumn('reporting_domain'));
        }
    }
};
