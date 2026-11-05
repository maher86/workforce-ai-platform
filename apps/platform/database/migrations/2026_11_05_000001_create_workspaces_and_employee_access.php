<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('employee_only')->default(false);
        });
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['owner', 'manager', 'employee']);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'user_id']);
            $table->unique(['id', 'tenant_id']);
        });
        foreach (['employee_invitations', 'employee_devices'] as $name) {
            Schema::create($name, function (Blueprint $table) use ($name) {
                $table->id();
                $table->unsignedBigInteger('tenant_id');
                $table->unsignedBigInteger('membership_id');
                $table->string('token_hash', 64)->unique();
                $table->timestamp('expires_at');
                $table->timestamp($name === 'employee_invitations' ? 'used_at' : 'revoked_at')->nullable();
                $table->timestamps();
                $table->foreign(['membership_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('memberships')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_devices');
        Schema::dropIfExists('employee_invitations');
        Schema::dropIfExists('memberships');
        Schema::dropIfExists('tenants');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('employee_only'));
    }
};
