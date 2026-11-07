<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('plate', 80);
            $table->string('plate_key', 80);
            $table->timestamps();
            $table->unique(['tenant_id', 'plate_key']);
            $table->unique(['id', 'tenant_id']);
        });
        Schema::table('reports', function (Blueprint $table) {
            $table->unsignedBigInteger('vehicle_id')->nullable();
            $table->foreign(['vehicle_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('vehicles');
            $table->index(['tenant_id', 'vehicle_id', 'created_at']);
            $table->index(['tenant_id', 'membership_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropForeign(['vehicle_id', 'tenant_id']);
            $table->dropIndex(['tenant_id', 'vehicle_id', 'created_at']);
            $table->dropIndex(['tenant_id', 'membership_id', 'created_at']);
            $table->dropColumn('vehicle_id');
        });
        Schema::dropIfExists('vehicles');
    }
};
