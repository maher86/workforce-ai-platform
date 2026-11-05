<?php

use App\Http\Controllers\EmployeeAccessController;
use App\Http\Controllers\WorkforceController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [WorkforceController::class, 'index'])->name('dashboard');
    Route::get('tenants/{tenant}/team', [WorkforceController::class, 'index'])->whereNumber('tenant')->name('team');
    Route::post('tenants', [WorkforceController::class, 'createTenant'])->middleware('throttle:10,1');
    Route::post('tenants/{tenant}/employees', [WorkforceController::class, 'addEmployee'])->whereNumber('tenant')->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/invite', [WorkforceController::class, 'invite'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/revoke', [WorkforceController::class, 'revoke'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
});

Route::inertia('employee/connect', 'employee/connect')->name('employee.connect');
Route::inertia('employee/activate', 'employee/activate')->middleware('throttle:30,1');
Route::post('employee/activate', [EmployeeAccessController::class, 'activate'])->middleware('throttle:10,1');
Route::get('employee', [EmployeeAccessController::class, 'home'])->middleware('auth')->name('employee.home');
Route::post('employee/disconnect', [EmployeeAccessController::class, 'disconnect'])->middleware('auth');

require __DIR__.'/settings.php';
