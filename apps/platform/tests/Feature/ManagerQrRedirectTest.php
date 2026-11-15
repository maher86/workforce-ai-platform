<?php

namespace Tests\Feature;

use App\Http\Middleware\HandleInertiaRequests;
use App\Models\User;
use App\Modules\Identity\EmployeeActivation;
use App\Modules\Identity\ManageWorkforce;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ManagerQrRedirectTest extends TestCase
{
    use RefreshDatabase;

    public function test_photo_request_cannot_turn_qr_validation_into_a_binary_image_modal(): void
    {
        $this->withoutVite();
        Storage::fake('reports');
        $owner = User::factory()->create();
        $team = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic redirect workspace');
        $employee = app(ManageWorkforce::class)->addEmployee($owner, $team->id, 'Synthetic person');
        $path = 'profiles/'.$team->id.'/'.$employee->id.'/synthetic.jpg';
        Storage::disk('reports')->put($path, 'synthetic image');
        $employee->update(['profile_photo_path' => $path]);
        $activation = app(EmployeeActivation::class);
        $activation->consume($activation->issue($owner, $team->id, $employee->id));
        $url = '/tenants/'.$team->id.'/team';
        $this->actingAs($owner)->get($url)->assertOk();
        $this->get('/tenants/'.$team->id.'/employees/'.$employee->id.'/photo')->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->assertSame(url($url), session()->previousUrl());
        $this->post('/tenants/'.$team->id.'/employees/'.$employee->id.'/invite')->assertRedirect($url)->assertSessionHasErrors('device');
    }

    public function test_inertia_navigation_is_tracked_but_json_polling_is_not(): void
    {
        $this->withoutVite();
        $owner = User::factory()->create();
        $team = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic redirect workspace');
        $url = '/tenants/'.$team->id.'/team';
        $this->actingAs($owner)->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Version' => app(HandleInertiaRequests::class)->version(Request::create($url)), 'X-Requested-With' => 'XMLHttpRequest'])->get($url)->assertOk();
        $this->assertSame(url($url), session()->previousUrl());
        $this->get('/employee/device-clock')->assertOk();
        $this->assertSame(url($url), session()->previousUrl());
    }
}
