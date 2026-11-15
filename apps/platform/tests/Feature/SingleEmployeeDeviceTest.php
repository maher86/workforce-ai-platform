<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\DeviceKey;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\EmployeeDevice;
use App\Modules\Identity\EmployeeInvitation;
use App\Modules\Identity\ManageWorkforce;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SingleEmployeeDeviceTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_policy_migration_keeps_newest_valid_device_and_preserves_history(): void
    {
        [$owner, $tenant, $member] = $this->team();
        $migration = require database_path('migrations/2026_11_15_000001_enforce_single_employee_device.php');
        $migration->down();
        $ids = [];
        foreach ([[-3, 10], [-2, -1], [-1, 10]] as [$created, $expires]) {
            $ids[] = DB::table('employee_devices')->insertGetId(['tenant_id' => $tenant->id, 'membership_id' => $member->id,
                'token_hash' => hash('sha256', Str::random(64)), 'expires_at' => now()->addDays($expires), 'created_at' => now()->addDays($created), 'updated_at' => now()]);
        }
        $migration->up();
        $this->assertSame($ids[2], EmployeeDevice::query()->whereNull('revoked_at')->sole()->id);
        $this->assertDatabaseCount('employee_devices', 3);
        $this->assertSame(2, DB::table('audit_entries')->where('action', 'device.single_device_retired')->count());
    }

    public function test_android_activation_uses_signed_fresh_navigation_instead_of_replaying_post_proof(): void
    {
        [$owner, $tenant, $member] = $this->team();
        [$key, $public] = $this->key();
        $token = app(EmployeeActivation::class)->issue($owner, $tenant->id, $member->id, 'android');
        $this->withHeaders(['X-Inertia' => 'true'])->post('/employee/activate', ['token' => $token, 'public_key' => $public,
            'signature' => $this->signed($key, DeviceKey::activationMessage($token, $public))])->assertStatus(409)->assertHeader('X-Inertia-Location', '/employee')->assertCookie('workforce_device');
    }

    private function team(): array
    {
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic device workspace');

        return [$owner, $tenant, app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic person')];
    }

    private function key(): array
    {
        $key = openssl_pkey_new(['private_key_type' => OPENSSL_KEYTYPE_EC, 'curve_name' => 'prime256v1']);
        $pem = openssl_pkey_get_details($key)['key'];
        $public = str_replace(['-----BEGIN PUBLIC KEY-----', '-----END PUBLIC KEY-----', "\n", "\r"], '', $pem);

        return [$key, $public];
    }

    private function signed($key, string $message): string
    {
        openssl_sign($message, $signature, $key, OPENSSL_ALGO_SHA256);

        return base64_encode($signature);
    }

    private function android(): array
    {
        [$owner, $tenant, $member] = $this->team();
        [$key, $public] = $this->key();
        $service = app(EmployeeActivation::class);
        $token = $service->issue($owner, $tenant->id, $member->id, 'android');
        $grant = $service->consume($token, $public, $this->signed($key, DeviceKey::activationMessage($token, $public)));

        return [$owner, $tenant, $member, $grant, $key];
    }

    private function headers($key, string $method = 'GET', string $target = '/employee', ?string $time = null): array
    {
        $time ??= (string) now()->timestamp;
        $nonce = bin2hex(random_bytes(16));

        return ['X-Workforce-Time' => $time, 'X-Workforce-Nonce' => $nonce,
            'X-Workforce-Proof' => $this->signed($key, DeviceKey::requestMessage($method, $target, $time, $nonce))];
    }

    public function test_new_qr_and_forged_unused_invitation_cannot_create_second_device(): void
    {
        [$owner, $tenant, $member] = $this->team();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $member->id));
        try {
            $service->issue($owner, $tenant->id, $member->id);
            $this->fail('Must use transfer');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('device', $exception->errors());
        }
        $token = Str::random(64);
        EmployeeInvitation::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addMinutes(5)]);
        try {
            $service->consume($token);
            $this->fail('Second consume must fail');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('token', $exception->errors());
        }
        $this->assertNull($grant['device']->fresh()->revoked_at);
        $this->assertSame(1, EmployeeDevice::query()->whereNull('revoked_at')->count());
        $this->assertNull(EmployeeInvitation::query()->where('token_hash', hash('sha256', $token))->first()->used_at);
    }

    public function test_database_constraint_is_a_second_line_of_defense(): void
    {
        [$owner, $tenant, $member] = $this->team();
        app(EmployeeActivation::class)->consume(app(EmployeeActivation::class)->issue($owner, $tenant->id, $member->id));
        $this->expectException(QueryException::class);
        DB::transaction(fn () => EmployeeDevice::query()->create(['tenant_id' => $tenant->id, 'membership_id' => $member->id, 'token_hash' => hash('sha256', Str::random(64)), 'expires_at' => now()->addDay()]));
    }

    public function test_manager_transfer_requires_confirmation_and_fresh_device_and_preserves_history(): void
    {
        [$owner, $tenant, $member] = $this->team();
        $service = app(EmployeeActivation::class);
        $grant = $service->consume($service->issue($owner, $tenant->id, $member->id));
        $url = '/tenants/'.$tenant->id.'/employees/'.$member->id.'/transfer';
        $this->actingAs($owner)->postJson($url, ['expected_device_id' => $grant['device']->id, 'device_mode' => 'browser'])->assertUnprocessable();
        $this->postJson($url, ['confirmed' => true, 'expected_device_id' => $grant['device']->id + 100, 'device_mode' => 'browser'])->assertUnprocessable();
        $this->assertNull($grant['device']->fresh()->revoked_at);
        $this->post($url, ['confirmed' => true, 'expected_device_id' => $grant['device']->id, 'device_mode' => 'browser'])->assertRedirect()->assertSessionHas('activation.url');
        $this->assertNotNull($grant['device']->fresh()->revoked_at);
        $token = explode('#', session('activation.url'))[1];
        $new = $service->consume($token);
        $this->postJson($url, ['confirmed' => true, 'expected_device_id' => $grant['device']->id, 'device_mode' => 'browser'])->assertUnprocessable();
        $this->assertNull($new['device']->fresh()->revoked_at);
        $this->assertDatabaseCount('employee_devices', 2);
        $this->assertDatabaseHas('audit_entries', ['action' => 'device.transfer_revoked', 'entity_id' => $grant['device']->id]);
    }

    public function test_foreign_tenant_transfer_and_employee_transfer_are_denied(): void
    {
        [$owner, $tenant] = $this->team();
        [$otherOwner, $otherTenant, $other] = $this->team();
        $grant = app(EmployeeActivation::class)->consume(app(EmployeeActivation::class)->issue($otherOwner, $otherTenant->id, $other->id));
        $payload = ['confirmed' => true, 'expected_device_id' => $grant['device']->id, 'device_mode' => 'browser'];
        $this->actingAs($owner)->post('/tenants/'.$tenant->id.'/employees/'.$other->id.'/transfer', $payload)->assertNotFound();
        $this->post('/tenants/'.$otherTenant->id.'/employees/'.$other->id.'/transfer', $payload)->assertNotFound();
        $this->assertNull($grant['device']->fresh()->revoked_at);
    }

    public function test_android_requires_possession_before_consuming_and_rejects_cookie_only_copy(): void
    {
        [$owner, $tenant, $member] = $this->team();
        [$key, $public] = $this->key();
        $service = app(EmployeeActivation::class);
        $token = $service->issue($owner, $tenant->id, $member->id, 'android');
        $this->post('/employee/activate', ['token' => $token])->assertSessionHasErrors('token');
        $this->assertDatabaseCount('employee_devices', 0);
        $grant = $service->consume($token, $public, $this->signed($key, DeviceKey::activationMessage($token, $public)));
        $this->withCookie('workforce_device', $grant['token'])->get('/employee')->assertUnauthorized()->assertJsonPath('code', 'DEVICE_PROOF_REQUIRED');
        $this->assertGuest();
        $this->get('/employee/connect')->assertUnauthorized();
        $this->withHeaders($this->headers($key))->get('/employee')->assertOk();
        $this->assertAuthenticatedAs($grant['user']);
    }

    public function test_signed_requests_reject_replay_wrong_key_method_target_stale_time_and_revocation(): void
    {
        [$owner, $tenant, $member, $grant, $key] = $this->android();
        [$foreignKey] = $this->key();
        $this->withCookie('workforce_device', $grant['token']);
        foreach ([$this->headers($foreignKey), $this->headers($key, 'POST'), $this->headers($key, 'GET', '/employee/history'), $this->headers($key, 'GET', '/employee', (string) now()->subMinutes(11)->timestamp)] as $headers) {
            $this->withHeaders($headers)->get('/employee')->assertUnauthorized();
        }
        $headers = $this->headers($key);
        $this->withHeaders($headers)->get('/employee')->assertOk();
        $this->withHeaders($headers)->get('/employee')->assertUnauthorized();
        $this->assertDatabaseCount('employee_device_proofs', 1);
        app(ManageWorkforce::class)->revokeAccess($owner, $tenant->id, $member->id);
        $this->withHeaders($this->headers($key))->get('/employee')->assertRedirect('/employee/connect');
    }

    public function test_expired_device_can_be_replaced_and_pruning_never_removes_devices(): void
    {
        [$owner, $tenant, $member, $grant, $key] = $this->android();
        $this->withCookie('workforce_device', $grant['token'])->withHeaders($this->headers($key))->get('/employee')->assertOk();
        $this->travel(21)->minutes();
        $this->artisan('devices:prune-proofs')->assertSuccessful();
        $this->assertDatabaseCount('employee_device_proofs', 0);
        $this->assertDatabaseCount('employee_devices', 1);
        $grant['device']->update(['expires_at' => now()->subSecond()]);
        $new = app(EmployeeActivation::class)->consume(app(EmployeeActivation::class)->issue($owner, $tenant->id, $member->id));
        $this->assertNotNull($grant['device']->fresh()->revoked_at);
        $this->assertNull($new['device']->revoked_at);
    }

    public function test_android_personal_photo_requires_fresh_proof_and_signed_post_redirect_does_not_replay_it(): void
    {
        $this->withoutVite();
        Storage::fake('reports');
        [, $tenant, $member, $grant, $key] = $this->android();
        $path = 'profiles/'.$tenant->id.'/'.$member->id.'/synthetic.jpg';
        Storage::disk('reports')->put($path, 'synthetic image');
        $member->update(['profile_photo_path' => $path]);
        $photo = '/employee/profile/photo';
        $this->withCookie('workforce_device', $grant['token'])->get($photo)->assertUnauthorized();
        $this->withHeaders($this->headers($key, 'GET', $photo))->get($photo)->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        // A validation redirect is also a new navigation, never the POST proof reused as GET.
        $this->withHeaders(array_merge($this->headers($key, 'POST', '/employee/profile'), ['X-Inertia' => 'true']))
            ->post('/employee/profile', [])->assertStatus(409)->assertHeader('X-Inertia-Location', '/employee');
        $this->flushHeaders();
        $this->withHeaders($this->headers($key))->get('/employee')->assertOk();
        [, $foreign] = $this->team();
        $target = '/tenants/'.$foreign->id.'/team';
        $this->withHeaders($this->headers($key, 'GET', $target))->get($target)->assertRedirect('/employee');
    }
}
