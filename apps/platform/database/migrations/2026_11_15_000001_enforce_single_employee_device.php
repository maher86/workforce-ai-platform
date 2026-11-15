<?php

use App\Modules\Audit\Audit;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy policy: preserve the newest valid credential, retire older/expired ones.
        // Never delete profiles, reports or credential/audit history.
        $seen = [];
        foreach (DB::table('employee_devices')->whereNull('revoked_at')->orderByDesc('created_at')->orderByDesc('id')->cursor() as $device) {
            if (Carbon::parse($device->expires_at)->isPast() || isset($seen[$device->membership_id])) {
                DB::table('employee_devices')->where('id', $device->id)->update(['revoked_at' => now(), 'updated_at' => now()]);
                Audit::record($device->tenant_id, null, 'device.single_device_retired', 'device', $device->id);
            } else {
                $seen[$device->membership_id] = true;
            }
        }
        Schema::table('employee_devices', function (Blueprint $table) {
            $table->string('binding_type', 16)->default('browser');
            $table->text('public_key')->nullable();
            $table->unique(['id', 'tenant_id']);
        });
        Schema::table('employee_invitations', fn (Blueprint $table) => $table->string('device_mode', 16)->default('browser'));
        DB::statement('CREATE UNIQUE INDEX employee_devices_single_active ON employee_devices (membership_id) WHERE revoked_at IS NULL');
        DB::statement("ALTER TABLE employee_devices ADD CONSTRAINT employee_device_binding_valid CHECK ((binding_type = 'browser' AND public_key IS NULL) OR (binding_type = 'android' AND public_key IS NOT NULL))");
        Schema::create('employee_device_proofs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedBigInteger('device_id');
            $table->string('nonce_hash', 64);
            $table->timestamp('expires_at')->index();
            $table->unique(['device_id', 'nonce_hash']);
            $table->foreign(['device_id', 'tenant_id'])->references(['id', 'tenant_id'])->on('employee_devices')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employee_device_proofs');
        DB::statement('DROP INDEX IF EXISTS employee_devices_single_active');
        DB::statement('ALTER TABLE employee_devices DROP CONSTRAINT IF EXISTS employee_device_binding_valid');
        Schema::table('employee_devices', function (Blueprint $table) {
            $table->dropUnique(['id', 'tenant_id']);
            $table->dropColumn(['binding_type', 'public_key']);
        });
        Schema::table('employee_invitations', fn (Blueprint $table) => $table->dropColumn('device_mode'));
        // Deliberately do not resurrect revoked credentials on rollback.
    }
};
