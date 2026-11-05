<?php

use App\Http\Controllers\EmployeeAccessController;
use App\Http\Controllers\EmployeeReportController;
use App\Http\Controllers\ManagerReportController;
use App\Http\Controllers\WorkforceController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('tenants/{tenant}/reports', [ManagerReportController::class, 'index'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/reports/export', [ManagerReportController::class, 'export'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/reports/{report}', [ManagerReportController::class, 'show'])->whereNumber(['tenant', 'report']);
    Route::delete('tenants/{tenant}/reports/{report}', [ManagerReportController::class, 'destroy'])->whereNumber(['tenant', 'report'])->middleware('throttle:10,1');
    Route::get('tenants/{tenant}/reports/{report}/media/{media}', [ManagerReportController::class, 'media'])->whereNumber(['tenant', 'report', 'media']);
    Route::post('tenants/{tenant}/reports/{report}/review', [ManagerReportController::class, 'review'])->whereNumber(['tenant', 'report'])->middleware('throttle:30,1');
    Route::post('tenants/{tenant}/reports/{report}/retry', [ManagerReportController::class, 'retry'])->whereNumber(['tenant', 'report'])->middleware('throttle:10,1');
    Route::post('tenants/{tenant}/work', [ManagerReportController::class, 'work'])->whereNumber('tenant')->middleware('throttle:30,1');
    Route::post('tenants/{tenant}/work/{work}/close', [ManagerReportController::class, 'closeWork'])->whereNumber(['tenant', 'work']);
    Route::get('dashboard', [WorkforceController::class, 'index'])->name('dashboard');
    Route::get('tenants/{tenant}/team', [WorkforceController::class, 'index'])->whereNumber('tenant')->name('team');
    Route::post('tenants', [WorkforceController::class, 'createTenant'])->middleware('throttle:10,1');
    Route::post('tenants/{tenant}/employees', [WorkforceController::class, 'addEmployee'])->whereNumber('tenant')->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/invite', [WorkforceController::class, 'invite'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/revoke', [WorkforceController::class, 'revoke'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/enable', [WorkforceController::class, 'enable'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/managers', [WorkforceController::class, 'addManager'])->whereNumber('tenant')->middleware('throttle:5,1');
    Route::post('tenants/{tenant}/managers/{membership}/disable', [WorkforceController::class, 'removeManager'])->whereNumber(['tenant', 'membership'])->middleware('throttle:5,1');
});

Route::inertia('employee/connect', 'employee/connect')->name('employee.connect');
Route::inertia('employee/activate', 'employee/activate')->middleware('throttle:30,1');
Route::post('employee/activate', [EmployeeAccessController::class, 'activate'])->middleware('throttle:10,1');
Route::get('employee', [EmployeeAccessController::class, 'home'])->middleware('auth')->name('employee.home');
Route::post('employee/disconnect', [EmployeeAccessController::class, 'disconnect'])->middleware('auth');
Route::post('employee/reports', [EmployeeReportController::class, 'store'])->middleware(['auth', 'throttle:10,1']);
Route::get('employee/reports/{report}', [EmployeeReportController::class, 'show'])->whereNumber('report')->middleware('auth');
Route::get('employee/reports/{report}/media/{media}', [EmployeeReportController::class, 'media'])->whereNumber(['report', 'media'])->middleware('auth');

require __DIR__.'/settings.php';
