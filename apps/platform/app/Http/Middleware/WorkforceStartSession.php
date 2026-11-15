<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Session\Middleware\StartSession;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class WorkforceStartSession extends StartSession
{
    protected function handleStatefulRequest(Request $request, $session, Closure $next)
    {
        return parent::handleStatefulRequest($request, $session, function (Request $request) use ($next) {
            $response = $next($request);
            // Private images/audio/JSON polling must never become redirect-back destinations.
            $navigable = $response->getStatusCode() === 200
                && ! $response instanceof BinaryFileResponse && ! $response instanceof StreamedResponse
                && ($response->headers->has('X-Inertia') || str_starts_with((string) $response->headers->get('Content-Type'), 'text/html'));
            $request->attributes->set('workforce.navigation', $navigable);

            return $response;
        });
    }

    protected function storeCurrentUrl(Request $request, $session)
    {
        if ($request->attributes->get('workforce.navigation') && $request->isMethod('GET') && $request->route() instanceof Route
            && (! $request->ajax() || $request->header('X-Inertia')) && ! $request->prefetch() && ! $request->isPrecognitive()) {
            $session->setPreviousUrl($request->fullUrl());
            if (method_exists($session, 'setPreviousRoute')) {
                $session->setPreviousRoute($request->route()->getName());
            }
        }
    }
}
