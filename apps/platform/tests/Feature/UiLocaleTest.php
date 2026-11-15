<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class UiLocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_locale_can_switch_both_ways_and_rejects_invalid_values(): void
    {
        $this->withoutVite();
        $this->from('/login')->post('/locale', ['locale' => 'en'])->assertRedirect('/login')->assertCookie('workforce_locale');
        $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page->where('uiLocale', 'en'));
        $this->from('/login')->post('/locale', ['locale' => 'ar'])->assertRedirect('/login');
        $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page->where('uiLocale', 'ar'));
        $this->post('/locale', ['locale' => '../invalid'])->assertSessionHasErrors('locale');
        $this->assertSame('ar', session('ui_locale'));
    }

    public function test_fifty_employee_directory_and_overview_have_bounded_query_counts(): void
    {
        $this->withoutVite();
        Queue::fake();
        $owner = User::factory()->create();
        $tenant = app(ManageWorkforce::class)->createTenant($owner, 'Synthetic 50 employee workspace');
        for ($i = 0; $i < 50; $i++) {
            app(ManageWorkforce::class)->addEmployee($owner, $tenant->id, 'Synthetic employee '.$i);
        }
        $this->actingAs($owner)->withSession(['ui_locale' => 'en']);
        DB::enableQueryLog();
        $this->get('/tenants/'.$tenant->id.'/team')->assertOk()->assertInertia(fn (Assert $page) => $page->has('employees', 50)->where('uiLocale', 'en'));
        $this->assertLessThan(20, count(DB::getQueryLog()), 'Team must not issue one query per employee.');
        DB::flushQueryLog();
        $this->get('/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->has('people', 50)->where('summary.reports', 0));
        $this->assertLessThan(20, count(DB::getQueryLog()), 'Overview queries must remain bounded with 50 employees.');
        DB::disableQueryLog();
    }
}
