<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetUiLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->session()->get('ui_locale', $request->cookie('workforce_locale', 'ar'));
        app()->setLocale(in_array($locale, ['ar', 'en'], true) ? $locale : 'ar');

        return $next($request);
    }
}
