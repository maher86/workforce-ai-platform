<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        return self::apply($next($request));
    }

    public static function apply(Response $response): Response
    {
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        // Keep native recording and existing scripts working; disallow framing and plugins.
        $response->headers->set('Content-Security-Policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'");

        return $response;
    }
}
