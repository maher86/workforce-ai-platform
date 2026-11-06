<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('memberships', function (Blueprint $table) {
            $table->string('display_name', 120)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('profile_photo_path')->nullable();
        });
        DB::statement("ALTER TABLE memberships ADD CONSTRAINT membership_photo_path CHECK (profile_photo_path IS NULL OR profile_photo_path LIKE 'profiles/' || tenant_id::text || '/' || id::text || '/%')");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE memberships DROP CONSTRAINT membership_photo_path');
        Schema::table('memberships', fn (Blueprint $table) => $table->dropColumn(['display_name', 'phone', 'profile_photo_path']));
    }
};
