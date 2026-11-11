<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;

class UiLocaleController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $data = $request->validate(['locale' => 'required|in:ar,en']);
        $request->session()->put('ui_locale', $data['locale']);
        Cookie::queue('workforce_locale', $data['locale'], 525600, '/', null, $request->isSecure(), true, false, 'lax');

        return back(303);
    }
}
