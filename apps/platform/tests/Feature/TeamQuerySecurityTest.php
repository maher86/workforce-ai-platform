<?php

namespace Tests\Feature;

use App\Models\User;
use App\Modules\Identity\ManageWorkforce;
use App\Modules\Identity\Membership;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class TeamQuerySecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_roster_pages_and_search_remain_tenant_scoped_and_totals_are_not_page_counts(): void
    {
        $this->withoutVite();
        $service = app(ManageWorkforce::class);
        $owner = User::factory()->create();
        $tenant = $service->createTenant($owner, 'Synthetic company');
        for ($i = 0; $i < 30; $i++) {
            $service->addEmployee($owner, $tenant->id, 'Synthetic employee '.$i);
        }
        $needle = $service->addEmployee($owner, $tenant->id, 'Literal_% employee');
        $needle->update(['phone' => '+971501234567', 'active' => false]);
        // Legacy names still work when only the account holds the display name.
        $legacy = $service->addEmployee($owner, $tenant->id, "O'Reilly mechanic");
        $legacy->update(['display_name' => null]);
        $otherOwner = User::factory()->create();
        $foreign = $service->createTenant($otherOwner, 'Other synthetic company');
        $service->addEmployee($otherOwner, $foreign->id, 'Literal_% employee');
        Membership::query()->create(['tenant_id' => $foreign->id, 'user_id' => $owner->id, 'role' => 'manager']);
        $base = '/tenants/'.$tenant->id.'/team';
        $this->actingAs($owner)->get($base)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('employees', 24)->where('employeePages.total', 32)->where('summary.employees', 31)
            ->where('employeePages.previous', null)->where('employeePages.next', fn ($url) => str_contains($url, 'page=2')));
        $this->get($base.'?page=2')->assertInertia(fn (Assert $page) => $page->has('employees', 8)->where('summary.employees', 31));
        foreach (['_%', '+971501234567'] as $term) {
            $this->get($base.'?'.http_build_query(['search' => $term]))->assertInertia(fn (Assert $page) => $page
                ->has('employees', 1)->where('employees.0.id', $needle->id)->where('employeePages.total', 1)->where('summary.employees', 31));
        }
        $this->get($base.'?'.http_build_query(['search' => "o'reILLY"]))->assertInertia(fn (Assert $page) => $page->has('employees', 1)->where('employees.0.id', $legacy->id));
        $this->get($base.'?'.http_build_query(['search' => "%' OR 1=1 --"]))->assertInertia(fn (Assert $page) => $page->has('employees', 0));
        $this->get('/tenants/'.$foreign->id.'/team?search=Literal')->assertNotFound();
        $this->getJson($base.'?page=-1')->assertUnprocessable();
        $this->getJson($base.'?search[]=malformed')->assertUnprocessable();
        $this->getJson($base.'?search='.str_repeat('a', 121))->assertUnprocessable();
    }
}
