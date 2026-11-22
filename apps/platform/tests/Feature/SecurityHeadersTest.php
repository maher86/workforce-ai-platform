<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_headers_protect_public_redirect_and_error_responses_without_disabling_recording(): void
    {
        $this->withoutVite();
        config(['app.debug' => false, 'workforce.openai_key' => 'synthetic-server-key-never-render']);
        Route::get('/__security-test/forbidden', fn () => abort(403));
        Route::get('/__security-test/failure', fn () => throw new \RuntimeException('synthetic-private-diagnostic'));
        foreach (['/', '/up', '/dashboard', '/__security-test/forbidden', '/__security-test/missing', '/__security-test/failure'] as $path) {
            $this->get($path)
                ->assertHeader('X-Frame-Options', 'DENY')
                ->assertHeader('X-Content-Type-Options', 'nosniff')
                ->assertHeader('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
                ->assertDontSee('synthetic-server-key-never-render')
                ->assertDontSee('synthetic-private-diagnostic');
        }
        $this->getJson('/__security-test/failure')->assertInternalServerError()
            ->assertJsonPath('message', 'Server Error')->assertHeader('X-Frame-Options', 'DENY');
    }
}
