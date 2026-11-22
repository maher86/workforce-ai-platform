<?php

use App\Http\Middleware\EmployeeDeviceAccess;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetUiLocale;
use App\Http\Middleware\WorkforceStartSession;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);
        // Restore/revalidate the device after session startup, before route auth/guest guards.
        $middleware->prependToPriorityList(AuthenticatesRequests::class, EmployeeDeviceAccess::class);
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(replace: [StartSession::class => WorkforceStartSession::class], append: [
            EmployeeDeviceAccess::class,
            HandleAppearance::class,
            SetUiLocale::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Credentials must not be retained as old form input after validation failures.
        $exceptions->dontFlash(['token', 'public_key', 'signature', 'code', 'recovery_code']);
        $exceptions->respond(fn (Response $response) => SecurityHeaders::apply($response));
        $exceptions->report(function (QueryException $exception): bool {
            // SQL bindings can contain employee text. Keep them out of exception logs.
            Log::error('database_operation_failed', ['sqlstate' => (string) $exception->getCode()]);

            return false;
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
